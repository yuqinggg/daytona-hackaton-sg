import { runAgent } from "./agent-runner";
import { heuristicClassify } from "./classify";
import type { Scenario } from "./scenario";
import type { SandboxHandle, SandboxProvider } from "./sandbox";
import { updateTrial } from "./store";
import type { Trial } from "./types";

const LOG_TAIL_CHARS = 4000;

/**
 * One trial: fresh machine -> seed -> agent -> verify -> classify -> destroy.
 *
 * Never throws. A trial that blows up is data (`errored`), not an exception -
 * one bad sandbox must not take the other 49 down with it.
 */
export async function runTrial(
  trial: Trial,
  scenario: Scenario,
  provider: SandboxProvider,
  signal: AbortSignal,
): Promise<void> {
  const runId = trial.runId;
  const id = trial.id;
  const startedAt = Date.now();
  let box: SandboxHandle | undefined;

  const finish = (patch: Partial<Trial>, note?: string) => {
    const endedAt = Date.now();
    updateTrial(runId, id, { ...patch, startedAt, endedAt, durationMs: endedAt - startedAt }, note);
  };

  try {
    updateTrial(runId, id, { status: "provisioning", startedAt });
    box = await provider.create(scenario, `${runId}-${trial.index}`);
    updateTrial(runId, id, { sandboxId: box.id });
    if (signal.aborted) throw new Error("aborted");

    // --- seed ---------------------------------------------------------
    // Failures here are ours, not the agent's, so they're excluded from the
    // success rate. Conflating them would make a flaky clone look like a
    // flaky agent, which is exactly the lie this project exists to kill.
    updateTrial(runId, id, { status: "seeding" });
    const clone = await box.exec(
      `git clone --depth 1 --branch ${scenario.ref} ${scenario.repo} ${box.repoDir}`,
      { cwd: box.homeDir, timeoutSec: 180 },
    );
    if (clone.exitCode !== 0) {
      return finish(
        { status: "errored", failureMode: "infra_error", reason: "git clone failed", logTail: tail(clone.output) },
      );
    }
    for (const cmd of scenario.setup) {
      const res = await box.exec(cmd, { cwd: box.repoDir, timeoutSec: 300 });
      if (res.exitCode !== 0) {
        return finish({
          status: "errored",
          failureMode: "infra_error",
          reason: `setup failed: ${cmd}`,
          logTail: tail(res.output),
        });
      }
    }

    // --- agent --------------------------------------------------------
    updateTrial(runId, id, { status: "agent" });
    const agent = await runAgent(box, scenario);

    // Cheap, high-signal: did it change anything at all?
    const diff = await box.exec("git diff --name-only HEAD", { cwd: box.repoDir, timeoutSec: 30 });
    const filesChanged = diff.output.split("\n").map((s) => s.trim()).filter(Boolean);
    updateTrial(runId, id, { filesChanged });

    if (agent.exitCode !== 0 && filesChanged.length === 0) {
      return finish({
        status: "failed",
        failureMode: "agent_crash",
        reason: `agent exited ${agent.exitCode} without changing any files`,
        logTail: tail(agent.transcript),
      });
    }

    // --- verify -------------------------------------------------------
    // Verifier files land only now: after the agent is done and after the
    // diff above was taken, so they can be neither gamed nor counted as the
    // agent's own work.
    updateTrial(runId, id, { status: "verifying" });
    for (const f of scenario.resolvedVerifyFiles) {
      await box.writeFile(`${box.repoDir}/${f.remotePath}`, f.contents);
    }

    let exitCode = 0;
    let output = "";
    for (const cmd of scenario.verify) {
      const res = await box.exec(cmd, { cwd: box.repoDir, timeoutSec: scenario.timeoutSec });
      output += `$ ${cmd}\n${res.output}\n`;
      exitCode = res.exitCode;
      if (exitCode !== 0) break;
    }

    if (exitCode === 0) {
      return finish({ status: "passed", verifyExitCode: 0, logTail: tail(output) });
    }

    // Heuristics label it immediately so the grid stays live; the LLM pass in
    // report.ts refines the buckets once the whole run is in.
    const guess = heuristicClassify(output, filesChanged, exitCode);
    return finish({
      status: "failed",
      verifyExitCode: exitCode,
      failureMode: guess.mode,
      reason: guess.reason,
      logTail: tail(output),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return finish({
      status: "errored",
      failureMode: message === "aborted" ? "infra_error" : "infra_error",
      reason: message,
    });
  } finally {
    // The whole premise is 50 disposable machines. Leaking them is the one
    // unforgivable bug here.
    await box?.destroy();
  }
}

function tail(s: string): string {
  return s.length > LOG_TAIL_CHARS ? s.slice(-LOG_TAIL_CHARS) : s;
}
