import Anthropic from "@anthropic-ai/sdk";
import * as z from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "./env";
import type { FailureMode, Trial } from "./types";

/**
 * Two-stage failure classification.
 *
 * Stage 1 (heuristicClassify) is regex over the verify output. It runs the
 * instant a trial fails so the grid can colour a tile immediately, and it costs
 * nothing. It is right most of the time because build tools have loud, stable
 * error strings.
 *
 * Stage 2 (llmClassify) runs once, on the whole run, and only on the trials
 * stage 1 gave up on. Batching matters: it sees all the failures at once, so it
 * can spot that 11 tiles share one root cause - which is the actual insight the
 * demo is selling.
 */

interface Guess {
  mode: FailureMode;
  reason: string;
}

const RULES: Array<{ mode: FailureMode; re: RegExp; reason: string }> = [
  {
    mode: "missing_dependency",
    re: /cannot find module|ModuleNotFoundError|No module named|ImportError|is not recognized as|command not found|unresolved import/i,
    reason: "imported something it never installed",
  },
  {
    mode: "syntax_error",
    re: /SyntaxError|Unexpected token|IndentationError|parse error|expected .* but found/i,
    reason: "left the repo unparseable",
  },
  {
    mode: "no_changes",
    re: /no changes detected|nothing to commit|produced no diff/i,
    reason: "finished without editing anything",
  },
  {
    mode: "test_failure",
    re: /\d+ (failed|failing)|assert(ion)?(Error)? |expected .* (received|to be|but got)|FAIL /i,
    reason: "change was wrong - tests failed",
  },
  {
    mode: "timeout",
    re: /timed? ?out|exceeded wall clock|ETIMEDOUT|killed/i,
    reason: "ran out of time",
  },
];

export function heuristicClassify(
  log: string,
  filesChanged: string[],
  exitCode: number,
): Guess {
  if (exitCode === 124) return { mode: "timeout", reason: "ran out of time" };
  if (filesChanged.length === 0) {
    return { mode: "no_changes", reason: "finished without editing anything" };
  }
  for (const rule of RULES) {
    if (rule.re.test(log)) return { mode: rule.mode, reason: rule.reason };
  }
  return { mode: "other", reason: `verify exited ${exitCode}` };
}

const ClassificationSchema = z.object({
  classifications: z.array(
    z.object({
      trial_id: z.string(),
      mode: z.enum([
        "missing_dependency",
        "test_failure",
        "no_changes",
        "wrong_file",
        "syntax_error",
        "incomplete",
        "timeout",
        "agent_crash",
        "infra_error",
        "other",
      ]),
      /** One plain sentence. This is what goes on the screen. */
      reason: z.string(),
    }),
  ),
});

/**
 * Refine the ambiguous failures in one batched call. Returns a map of
 * trialId -> Guess. Never throws: if this call fails, the heuristic labels
 * stand and the demo still has a report card.
 */
export async function llmClassify(trials: Trial[]): Promise<Map<string, Guess>> {
  const out = new Map<string, Guess>();
  const ambiguous = trials.filter(
    (t) => t.status === "failed" && (t.failureMode === "other" || !t.failureMode),
  );
  if (ambiguous.length === 0 || env.mock || !env.anthropicApiKey) return out;

  const payload = ambiguous
    .map((t) => `<trial id="${t.id}">\n${(t.logTail ?? "").slice(-2000)}\n</trial>`)
    .join("\n\n");

  try {
    const client = new Anthropic({
      apiKey: env.anthropicApiKey,
      ...(env.anthropicWorkspaceId
        ? { defaultHeaders: { "anthropic-workspace-id": env.anthropicWorkspaceId } }
        : {}),
    });
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system:
        "You classify why a coding agent failed a task. You are given verify-step logs from independent sandbox runs of the SAME task. " +
        "For each trial, pick the single failure mode that best explains it, and write one short plain sentence a person could read off a slide. " +
        "Prefer a specific mode over 'other'. If several trials share a root cause, describe it the same way in each so they group cleanly.",
      messages: [{ role: "user", content: payload }],
      output_config: { format: zodOutputFormat(ClassificationSchema) },
    });

    for (const c of response.parsed_output?.classifications ?? []) {
      out.set(c.trial_id, { mode: c.mode as FailureMode, reason: c.reason });
    }
  } catch {
    // Heuristic labels remain. Degraded, not broken.
  }
  return out;
}
