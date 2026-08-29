import { randomUUID } from "node:crypto";
import { daytonaProvider } from "./daytona";
import { assertLiveCredentials, env } from "./env";
import { mockProvider } from "./mock";
import { buildReport } from "./report";
import type { Scenario } from "./scenario";
import type { SandboxProvider } from "./sandbox";
import { createRun, publish, updateRun } from "./store";
import { runTrial } from "./trial";
import type { Run, Trial } from "./types";

/**
 * Fans one task out across N isolated sandboxes and keeps `concurrency` of
 * them in flight until every trial is terminal.
 *
 * Concurrency is a real limit, not a knob for show: Daytona quota and the
 * Anthropic rate limit both bite well before 50 simultaneous agents. The grid
 * still renders all 50 tiles from the start, so the audience sees the full
 * experiment while the pool works through it.
 */

// Pinned to globalThis for the same reason as the store - see store.ts.
const globalRef = globalThis as typeof globalThis & {
  __reliabilityRunning?: Map<string, AbortController>;
};
const running: Map<string, AbortController> = (globalRef.__reliabilityRunning ??=
  new Map());

export interface StartRunOptions {
  scenario: Scenario;
  trials?: number;
  concurrency?: number;
}

export function startRun(opts: StartRunOptions): Run {
  assertLiveCredentials();

  const trialCount = opts.trials ?? 50;
  const runId = randomUUID().slice(0, 8);

  const trials: Trial[] = Array.from({ length: trialCount }, (_, index) => ({
    id: `${runId}-t${String(index).padStart(2, "0")}`,
    runId,
    index,
    status: "queued" as const,
    history: [],
  }));

  const run: Run = {
    id: runId,
    scenarioId: opts.scenario.id,
    scenarioName: opts.scenario.name,
    trialCount,
    concurrency: opts.concurrency ?? env.concurrency,
    status: "running",
    createdAt: Date.now(),
    trials,
    mock: env.mock,
  };

  createRun(run);
  publish({ type: "run:snapshot", run });

  const controller = new AbortController();
  running.set(runId, controller);

  // Fire and forget: the HTTP request that starts a run returns immediately
  // and the client watches progress over SSE.
  void execute(run, opts.scenario, controller.signal).finally(() => {
    running.delete(runId);
  });

  return run;
}

export function abortRun(runId: string) {
  running.get(runId)?.abort();
  updateRun(runId, { status: "aborted", finishedAt: Date.now() });
}

async function execute(run: Run, scenario: Scenario, signal: AbortSignal) {
  const provider: SandboxProvider = env.mock ? mockProvider : daytonaProvider;

  // Simple worker pool over a shared cursor - N workers pulling from one queue
  // keeps every slot busy, which a chunked Promise.all does not.
  let cursor = 0;
  const next = () => (cursor < run.trials.length ? run.trials[cursor++] : undefined);

  const worker = async () => {
    for (let trial = next(); trial; trial = next()) {
      if (signal.aborted) return;
      await runTrial(trial, scenario, provider, signal);
    }
  };

  const workers = Array.from({ length: Math.min(run.concurrency, run.trials.length) }, worker);
  await Promise.all(workers);

  if (signal.aborted) {
    updateRun(run.id, { status: "aborted", finishedAt: Date.now() });
    return;
  }

  const report = await buildReport(run.trials);
  updateRun(run.id, { report, status: "completed", finishedAt: Date.now() });
}
