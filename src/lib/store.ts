import type { Run, RunEvent, Trial } from "./types";

/**
 * In-memory run store + fan-out bus. Deliberately not a database: the demo is
 * one process, one run at a time, and a Postgres dependency at a hackathon is
 * a way to lose 40 minutes. Swap for SQLite if runs need to outlive the server.
 */

type Subscriber = (event: RunEvent) => void;

interface StoreState {
  runs: Map<string, Run>;
  subscribers: Map<string, Set<Subscriber>>;
}

/**
 * Pinned to globalThis, not plain module scope.
 *
 * Next.js dev compiles each route into its own bundle and re-instantiates
 * shared modules when a new route compiles. With module-level `Map`s, the POST
 * that starts a run and the SSE route that streams it end up holding *different*
 * stores - the stream 404s and the grid freezes on its first snapshot. This is
 * the same singleton pattern the Prisma client needs, for the same reason.
 */
const globalRef = globalThis as typeof globalThis & {
  __reliabilityStore?: StoreState;
};

const state: StoreState = (globalRef.__reliabilityStore ??= {
  runs: new Map(),
  subscribers: new Map(),
});

const { runs, subscribers } = state;

export function createRun(run: Run): Run {
  runs.set(run.id, run);
  return run;
}

export function getRun(id: string): Run | undefined {
  return runs.get(id);
}

export function listRuns(): Run[] {
  return [...runs.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function subscribe(runId: string, fn: Subscriber): () => void {
  const set = subscribers.get(runId) ?? new Set();
  set.add(fn);
  subscribers.set(runId, set);
  return () => {
    set.delete(fn);
    if (set.size === 0) subscribers.delete(runId);
  };
}

export function publish(event: RunEvent) {
  const runId = "run" in event ? event.run.id : event.runId;
  for (const fn of subscribers.get(runId) ?? []) {
    try {
      fn(event);
    } catch {
      // A dead SSE connection must never take down the orchestrator.
    }
  }
}

/** Mutate a trial in place, then broadcast. The only write path for trials. */
export function updateTrial(
  runId: string,
  trialId: string,
  patch: Partial<Trial>,
  note?: string,
): Trial | undefined {
  const run = runs.get(runId);
  const trial = run?.trials.find((t) => t.id === trialId);
  if (!run || !trial) return;

  Object.assign(trial, patch);
  if (patch.status) {
    trial.history.push({ at: Date.now(), status: patch.status, note });
  }
  publish({ type: "trial:update", runId, trial });
  return trial;
}

export function updateRun(runId: string, patch: Partial<Run>) {
  const run = runs.get(runId);
  if (!run) return;
  Object.assign(run, patch);
  if (patch.report) publish({ type: "run:report", runId, report: patch.report });
  if (patch.status && patch.status !== "running") {
    publish({ type: "run:done", runId, status: patch.status });
  }
}
