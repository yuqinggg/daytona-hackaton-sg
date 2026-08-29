import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { listScenarios } from "./scenario";
import { createRun, publish, updateRun, updateTrial } from "./store";
import type { Run, Trial } from "./types";

/**
 * Replays an archived run through the live UI.
 *
 * This is the demo's insurance policy, and on a free tier it is not optional.
 * A real run costs a day's request budget, so the measurement has to be made
 * once - unhurried, off-stage, retried across days if a rate limit bites - and
 * then shown on demand. What replays is the *recorded* run: real sandboxes,
 * real agent transcripts, real verdicts. Only the clock is synthetic.
 *
 * This is not the same as `MOCK=1`. Mock invents outcomes; replay shows
 * outcomes that actually happened. Say which one you are showing.
 */

const RUNS_DIR = () => path.join(process.cwd(), "runs");

export async function listArchived(): Promise<Array<{ id: string; label: string }>> {
  try {
    const scenarioNames = new Map(
      (await listScenarios()).map((scenario) => [scenario.id, scenario.name]),
    );
    const files = (await readdir(RUNS_DIR())).filter((f) => f.endsWith(".json")).sort();
    const out = await Promise.all(
      files.map(async (f) => {
        try {
          const run: Run = JSON.parse(await readFile(path.join(RUNS_DIR(), f), "utf8"));
          const pct = run.report ? Math.round(run.report.successRate * 100) : null;
          const when = new Date(run.createdAt).toISOString().slice(0, 16).replace("T", " ");
          const scenarioName =
            scenarioNames.get(run.scenarioId) ?? run.scenarioName.replaceAll("_", " ");
          return {
            id: path.basename(f, ".json"),
            label: `${scenarioName} · ${pct === null ? "No report" : `${pct}% success`} · ${when}`,
          };
        } catch {
          return null;
        }
      }),
    );
    return out.filter((x): x is { id: string; label: string } => x !== null);
  } catch {
    return []; // No runs/ directory yet is the normal state, not an error.
  }
}

/**
 * Loads an archived run under a fresh id and re-emits its trials on a
 * compressed clock, so the grid fills in the way it did live.
 *
 * Trials are replayed in the order they originally finished - that ordering is
 * real data, and it is what makes the grid look like work happening rather
 * than a table appearing.
 */
export async function startReplay(archivedId: string, durationMs = 40_000): Promise<Run> {
  const raw = await readFile(path.join(RUNS_DIR(), `${archivedId}.json`), "utf8");
  const source: Run = JSON.parse(raw);

  const runId = `rp${randomUUID().slice(0, 6)}`;
  const finished = [...source.trials].sort(
    (a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0),
  );

  // Every tile starts grey, exactly as a live run does.
  const trials: Trial[] = finished.map((t, index) => ({
    id: `${runId}-t${String(index).padStart(2, "0")}`,
    runId,
    index,
    status: "queued",
    history: [],
  }));

  const run: Run = {
    ...source,
    id: runId,
    trialCount: trials.length,
    status: "running",
    createdAt: Date.now(),
    finishedAt: undefined,
    report: undefined,
    trials,
    replayOf: archivedId,
  };

  createRun(run);
  publish({ type: "run:snapshot", run });

  void (async () => {
    const step = Math.max(300, Math.floor(durationMs / Math.max(1, trials.length)));
    for (const [index, original] of finished.entries()) {
      const id = trials[index].id;
      updateTrial(runId, id, { status: "agent", startedAt: Date.now() });
      await sleep(step * 0.55);
      updateTrial(runId, id, { status: "verifying" });
      await sleep(step * 0.45);
      updateTrial(runId, id, {
        status: original.status,
        failureMode: original.failureMode,
        reason: original.reason,
        verifyExitCode: original.verifyExitCode,
        logTail: original.logTail,
        filesChanged: original.filesChanged,
        durationMs: original.durationMs,
        endedAt: Date.now(),
      });
    }
    // The archived report is reused verbatim: re-deriving it would mean
    // another classifier call, and the recorded buckets are the finding.
    updateRun(runId, {
      report: source.report,
      status: "completed",
      finishedAt: Date.now(),
    });
  })();

  return run;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
