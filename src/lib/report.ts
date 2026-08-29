import { llmClassify } from "./classify";
import { MODE_LABELS } from "./labels";
import type { FailureBucket, FailureMode, RunReport, Trial } from "./types";

/**
 * Builds the report card. Runs the batched LLM classification pass first, so
 * the final buckets are tighter than the live heuristic ones - the numbers on
 * screen sharpen right as the run finishes, which is a nice beat in the demo.
 */
export async function buildReport(trials: Trial[]): Promise<RunReport> {
  const refined = await llmClassify(trials);
  for (const t of trials) {
    const better = refined.get(t.id);
    if (better) {
      t.failureMode = better.mode;
      t.reason = better.reason;
    }
  }

  const passed = trials.filter((t) => t.status === "passed");
  const failed = trials.filter((t) => t.status === "failed");
  const errored = trials.filter((t) => t.status === "errored");

  // Infra errors are excluded from the denominator on purpose: we are
  // measuring the agent, not our own plumbing. They stay visible in the grid
  // so the exclusion is honest rather than hidden.
  const scored = passed.length + failed.length;
  const successRate = scored === 0 ? 0 : passed.length / scored;

  const byMode = new Map<FailureMode, Trial[]>();
  for (const t of failed) {
    const mode = t.failureMode ?? "other";
    byMode.set(mode, [...(byMode.get(mode) ?? []), t]);
  }

  const buckets: FailureBucket[] = [...byMode.entries()]
    .map(([mode, ts]) => ({
      mode,
      count: ts.length,
      exemplar: ts.find((t) => t.reason)?.reason ?? MODE_LABELS[mode],
      trialIds: ts.map((t) => t.id),
    }))
    .sort((a, b) => b.count - a.count);

  const durations = trials
    .map((t) => t.durationMs ?? 0)
    .filter(Boolean)
    .sort((a, b) => a - b);
  const medianDurationMs = durations.length
    ? durations[Math.floor(durations.length / 2)]
    : 0;

  const pct = Math.round(successRate * 100);
  const top = buckets[0];
  let headline = top
    ? `${pct}% success rate. Most common failure: ${MODE_LABELS[top.mode]} (${top.count}/${failed.length} failures).`
    : `${pct}% success rate across ${scored} scored trials.`;

  // A clean percentage over a handful of trials is the most misleading thing
  // this tool can print. If most of the run never reached the agent, say so in
  // the same breath as the number.
  if (errored.length > trials.length * 0.1) {
    headline += ` WARNING: only ${scored}/${trials.length} trials reached the agent - ${errored.length} failed on infrastructure.`;
  }

  return {
    successRate,
    passed: passed.length,
    failed: failed.length,
    errored: errored.length,
    total: trials.length,
    medianDurationMs,
    buckets,
    headline,
  };
}
