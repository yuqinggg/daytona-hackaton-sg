import type { FailureMode, TrialStatus } from "./types";

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
  infra_error: "our setup broke - not the agent's fault",
  other: "something else",
};

export function modeLabel(mode: FailureMode): string {
  return MODE_LABELS[mode];
}

/**
 * What each stage is called on screen.
 *
 * The enum names are written for the code (`seeding`, `errored`); these are
 * written for whoever is looking at the screen for the first time. Nobody
 * outside this repo knows what "seeding" is, and a person watching a grid of
 * squares should not have to guess.
 */
export const STATUS_LABELS: Record<TrialStatus, string> = {
  queued: "Waiting to start",
  provisioning: "Starting a machine",
  seeding: "Setting up the code",
  agent: "Agent is working",
  verifying: "Running the tests",
  passed: "Passed",
  failed: "Failed",
  errored: "Didn't count",
};

export function statusLabel(status: TrialStatus): string {
  return STATUS_LABELS[status];
}

/**
 * The grid legend. Only terminal states plus "working" appear: the in-progress
 * stages differ by shade rather than colour, and spelling out five blues would
 * make the key harder to read than the thing it explains.
 */
export const LEGEND: Array<{ label: string; help: string; className: string }> = [
  {
    label: "Passed",
    help: "The agent's change made the tests pass.",
    className: "bg-pass",
  },
  {
    label: "Failed",
    help: "The agent finished, but the tests did not pass.",
    className: "bg-fail",
  },
  {
    label: "Working",
    help: "Still running: starting up, editing, or testing.",
    className: "bg-stage-3",
  },
  {
    label: "Didn't count",
    help: "Our setup broke, or the model provider refused. Left out of the score.",
    className: "bg-warn",
  },
  {
    label: "Not started",
    help: "Queued, waiting for a free slot.",
    className: "bg-idle",
  },
];
