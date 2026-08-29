import { AIDER_BIN, GOOSE_BIN, env } from "./env";
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
  if (scenario.agent === "aider") return runAider(box, scenario);
  if (scenario.agent === "goose") return runGoose(box, scenario);
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
 * Aider, the open-source pair-programmer, in headless one-shot mode.
 *
 * The venv is created by the scenario's `setup`, not here: a pip failure is
 * the harness's fault, and setup failures are already classified as
 * infra_error rather than counted against the agent.
 *
 * Aider commits by default. `--no-auto-commits` keeps its edits in the
 * working tree, which is where `verify` looks - and it keeps the trial honest,
 * since an agent that committed would otherwise look identical to one that
 * did not.
 */
async function runAider(box: SandboxHandle, scenario: Scenario): Promise<AgentResult> {
  const probe = await box.exec(`command -v ${AIDER_BIN} || command -v aider || true`, {
    cwd: box.homeDir,
    timeoutSec: 30,
  });
  const bin = probe.output.trim().split("\n").pop()?.trim();
  if (!bin) {
    return {
      exitCode: 127,
      transcript: "aider not found - the scenario's setup step must install it",
    };
  }

  // Aider refuses to touch a repo with no git identity, and the sandbox has
  // none. This configures the harness's own clone, not the agent's behaviour.
  await box.exec(
    'git config user.email harness@example.com && git config user.name "reliability harness"',
    { cwd: box.repoDir, timeoutSec: 30 },
  );

  // Identity-linked keys need a workspace header on every request. Claude Code
  // reads ANTHROPIC_CUSTOM_HEADERS; aider goes through litellm, which only
  // takes extra headers from this file.
  if (env.anthropicWorkspaceId) {
    await box.writeFile(
      `${box.homeDir}/.aider.model.settings.yml`,
      `- name: ${scenario.model}\n` +
        `  extra_params:\n` +
        `    extra_headers:\n` +
        `      anthropic-workspace-id: ${env.anthropicWorkspaceId}\n`,
    );
  }

  await box.writeFile(`${box.homeDir}/task.md`, scenario.task);

  const res = await box.exec(
    [
      bin,
      `--model ${scenario.model}`,
      `--message "$(cat ${box.homeDir}/task.md)"`,
      "--yes-always",
      "--no-auto-commits",
      "--no-check-update",
      "--no-pretty",
    ].join(" "),
    { cwd: box.repoDir, timeoutSec: scenario.timeoutSec },
  );
  return { exitCode: res.exitCode, transcript: res.output };
}

/**
 * goose, Block's open-source agent, in headless `run` mode.
 *
 * Two things this needs that a laptop gives it for free:
 *   1. A provider and model. goose normally reads these from an interactive
 *      `goose configure`; the env vars are the headless equivalent.
 *   2. Somewhere to put the API key. goose defaults to the system keyring,
 *      which does not exist in a container - without GOOSE_DISABLE_KEYRING it
 *      fails at startup on a secret store rather than on the task.
 */
async function runGoose(box: SandboxHandle, scenario: Scenario): Promise<AgentResult> {
  const probe = await box.exec(`command -v ${GOOSE_BIN} || command -v goose || true`, {
    cwd: box.homeDir,
    timeoutSec: 30,
  });
  const bin = probe.output.trim().split("\n").pop()?.trim();
  if (!bin) {
    return {
      exitCode: 127,
      transcript: "goose not found - the scenario's setup step must install it",
    };
  }

  const { provider, model } = splitModel(scenario.model);
  await box.writeFile(`${box.homeDir}/task.md`, scenario.task);

  const res = await box.exec(
    `GOOSE_DISABLE_KEYRING=1 GOOSE_PROVIDER=${provider} GOOSE_MODEL=${model} ` +
      `${bin} run --instructions ${box.homeDir}/task.md`,
    { cwd: box.repoDir, timeoutSec: scenario.timeoutSec },
  );
  return { exitCode: res.exitCode, transcript: res.output };
}

/**
 * `openrouter/qwen/qwen3-coder` -> provider `openrouter`, model
 * `qwen/qwen3-coder`. Only the first segment is the provider; model names
 * routinely contain slashes of their own.
 */
export function splitModel(spec: string): { provider: string; model: string } {
  const slash = spec.indexOf("/");
  if (slash === -1) return { provider: "anthropic", model: spec };
  return { provider: spec.slice(0, slash), model: spec.slice(slash + 1) };
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
