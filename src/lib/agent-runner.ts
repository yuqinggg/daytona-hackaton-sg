import type { Scenario } from "./scenario";
import type { SandboxHandle } from "./sandbox";

/**
 * Runs the agent-under-test inside an already-seeded sandbox.
 *
 * The agent is the thing being measured, so this file must stay dumb: hand it
 * the task, let it do whatever it wants to the machine, capture the transcript.
 * No retries, no nudging, no cleanup between the agent and the verifier. Any
 * help offered here inflates the success rate and invalidates the number.
 */

export interface AgentResult {
  exitCode: number;
  transcript: string;
}

export async function runAgent(
  box: SandboxHandle,
  scenario: Scenario,
): Promise<AgentResult> {
  if (scenario.agent === "claude-code") return runClaudeCode(box, scenario);
  return runShellAgent(box, scenario);
}

/**
 * Claude Code in headless mode.
 *
 * Two install realities, both discovered by the smoke test rather than guessed:
 *   1. The default Daytona sandbox already ships the `claude` CLI, so most
 *      trials need no install at all - worth ~30-60s each across 50 trials.
 *   2. When it is absent, plain `npm install -g` fails with EACCES: the sandbox
 *      user is `daytona` and the nvm global dir is root-owned. A home prefix
 *      avoids sudo entirely (and `sudo npm` does not work either - nvm is not
 *      on root's PATH).
 */
async function runClaudeCode(
  box: SandboxHandle,
  scenario: Scenario,
): Promise<AgentResult> {
  const probe = await box.exec("command -v claude || true", {
    cwd: box.homeDir,
    timeoutSec: 30,
  });
  let bin = probe.output.trim().split("\n").pop()?.trim() ?? "";

  if (!bin) {
    const install = await box.exec(
      "npm install -g --prefix $HOME/.npm-global @anthropic-ai/claude-code",
      { cwd: box.homeDir, timeoutSec: 300 },
    );
    if (install.exitCode !== 0) {
      return { exitCode: install.exitCode, transcript: install.output };
    }
    bin = `${box.homeDir}/.npm-global/bin/claude`;
  }

  // Task goes in via a file so quoting never mangles a multi-line prompt.
  await box.writeFile(`${box.homeDir}/task.md`, scenario.task);

  const res = await box.exec(
    `${bin} -p "$(cat ${box.homeDir}/task.md)" --permission-mode bypassPermissions --output-format text`,
    { cwd: box.repoDir, timeoutSec: scenario.timeoutSec },
  );
  return { exitCode: res.exitCode, transcript: res.output };
}

/**
 * Minimal baseline: one model call, one patch applied. Useful for showing that
 * the harness measures *any* agent, not just ours - and it's fast enough to
 * demo a second scenario if there's time left on stage.
 */
async function runShellAgent(
  box: SandboxHandle,
  scenario: Scenario,
): Promise<AgentResult> {
  await box.writeFile(`${box.homeDir}/task.md`, scenario.task);
  const res = await box.exec(
    `sh -c 'echo "shell-agent is a stub - implement or use agent: claude-code"; exit 1'`,
    { cwd: box.repoDir, timeoutSec: 60 },
  );
  return { exitCode: res.exitCode, transcript: res.output };
}
