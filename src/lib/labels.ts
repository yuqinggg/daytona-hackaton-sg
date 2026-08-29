import type { FailureMode } from "./types";

/**
 * Client-safe display strings. Kept out of report.ts on purpose: that module
 * pulls in the Anthropic SDK, and importing it from a client component would
 * drag the whole SDK into the browser bundle.
 *
 * These are the words that end up on screen, so they are written as plain
 * English blame, not enum names: "forgot to install the dependency" lands in a
 * room; "MISSING_DEPENDENCY" does not.
 */
export const MODE_LABELS: Record<FailureMode, string> = {
  missing_dependency: "forgot to install the dependency",
  test_failure: "wrong implementation - tests failed",
  no_changes: "made no changes at all",
  wrong_file: "edited the wrong file",
  syntax_error: "left broken syntax",
  incomplete: "stopped partway through",
  timeout: "ran out of time",
  agent_crash: "the agent itself crashed",
  infra_error: "harness/infra error (excluded)",
  other: "uncategorised",
};

export function modeLabel(mode: FailureMode): string {
  return MODE_LABELS[mode];
}
