import type { Scenario } from "./scenario";

/**
 * The one seam between the orchestrator and the outside world.
 *
 * Everything above this interface (orchestrator, trial lifecycle, classifier,
 * UI) is provider-agnostic and testable with the mock. Everything Daytona-
 * specific lives in daytona.ts. If the SDK surface differs from what's coded
 * there, this is the only file's worth of code that needs to change.
 *
 * Paths are resolved per-sandbox rather than hardcoded: the default Daytona
 * sandbox runs as `daytona` with a root-owned `/`, so `/workspace` is not
 * creatable and uploads there fail with "permission denied".
 */
export interface ExecResult {
  exitCode: number;
  output: string;
}

export interface SandboxHandle {
  id: string;
  /** Writable home for the sandbox user, resolved at creation. */
  homeDir: string;
  /** Where the scenario repo is cloned. Always inside homeDir. */
  repoDir: string;
  exec(command: string, opts?: { cwd?: string; timeoutSec?: number }): Promise<ExecResult>;
  writeFile(path: string, contents: string): Promise<void>;
  destroy(): Promise<void>;
}

export interface SandboxProvider {
  /** Create one fresh, isolated machine. Never reused across trials. */
  create(scenario: Scenario, label: string): Promise<SandboxHandle>;
}
