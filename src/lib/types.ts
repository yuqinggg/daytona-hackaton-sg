/**
 * Core domain types. One `Run` = one reliability report card:
 * N trials of the same task, each in its own throwaway Daytona sandbox.
 */

/** A single trial moves strictly forward through these. */
export type TrialStatus =
  | "queued"
  | "provisioning" // creating the Daytona sandbox
  | "seeding" // cloning the repo + running scenario.setup
  | "agent" // the agent-under-test is working
  | "verifying" // running scenario.verify
  | "passed"
  | "failed" // verify ran and did not pass -> has a FailureMode
  | "errored"; // harness/infra broke, not the agent's fault

export const TERMINAL_STATUSES: TrialStatus[] = ["passed", "failed", "errored"];

/**
 * The failure taxonomy. `other` is the escape hatch the LLM classifier uses
 * when nothing fits; a demo where everything lands in `other` means the
 * taxonomy needs a new bucket, not that the classifier is broken.
 */
export type FailureMode =
  | "missing_dependency" // agent edited code but never installed what it imported
  | "test_failure" // change is wrong: tests ran and failed
  | "no_changes" // agent finished without touching anything
  | "wrong_file" // edited the wrong module / created a duplicate
  | "syntax_error" // left the repo unparseable
  | "incomplete" // partial edit, stopped mid-task
  | "timeout" // blew the wall clock
  | "agent_crash" // agent process exited non-zero / API error
  | "infra_error" // sandbox, clone, or network failed -> excluded from rate
  | "other";

export interface TrialEventLog {
  at: number;
  status: TrialStatus;
  note?: string;
}

export interface Trial {
  id: string;
  runId: string;
  index: number; // 0..N-1, drives tile position in the grid
  status: TrialStatus;
  sandboxId?: string;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;

  /** Populated on failure. `reason` is one human sentence for the demo. */
  failureMode?: FailureMode;
  reason?: string;

  /** Verify step output, truncated. What the classifier reads. */
  verifyExitCode?: number;
  logTail?: string;

  /** Cheap signal for "did it even try": files the agent touched. */
  filesChanged?: string[];

  history: TrialEventLog[];
}

export type RunStatus = "pending" | "running" | "completed" | "aborted";

export interface FailureBucket {
  mode: FailureMode;
  count: number;
  /** One representative sentence, shown next to the bar in the report card. */
  exemplar: string;
  trialIds: string[];
}

export interface RunReport {
  successRate: number; // passed / (passed + failed), infra errors excluded
  passed: number;
  failed: number;
  errored: number;
  total: number;
  medianDurationMs: number;
  buckets: FailureBucket[]; // sorted desc by count
  headline: string; // "68% success rate. Most common failure: ..."
}

export interface Run {
  id: string;
  scenarioId: string;
  scenarioName: string;
  trialCount: number;
  concurrency: number;
  status: RunStatus;
  createdAt: number;
  finishedAt?: number;
  trials: Trial[];
  report?: RunReport;
  mock: boolean;
}

/** What the SSE endpoint pushes to the grid. */
export type RunEvent =
  | { type: "run:snapshot"; run: Run }
  | { type: "trial:update"; runId: string; trial: Trial }
  | { type: "run:report"; runId: string; report: RunReport }
  | { type: "run:done"; runId: string; status: RunStatus };
