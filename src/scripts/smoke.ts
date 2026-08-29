/**
 * Pre-flight for a scenario's environment. Provisions ONE real sandbox and
 * runs every step of a trial except the agent, then asserts the baseline.
 *
 * This exists because the expensive failures are environmental, not agentic:
 * a missing `git` in the image, a pip that needs a flag, a wrong working
 * directory. Those fail all 50 trials identically and look like a product bug
 * on stage. This catches them for the price of one sandbox and zero agent
 * tokens.
 *
 *   npm run smoke -- --scenario aider-format-tokens
 */
import "../lib/load-env";
import { daytonaProvider } from "../lib/daytona";
import { AIDER_BIN, GOOSE_BIN, assertLiveCredentials, env } from "../lib/env";
import { listScenarios, loadScenario } from "../lib/scenario";
import type { SandboxHandle } from "../lib/sandbox";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const ok = (m: string) => console.log(`  \x1b[32mok\x1b[0m    ${m}`);
const bad = (m: string) => console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`);
const info = (m: string) => console.log(`  \x1b[90m--\x1b[0m    ${m}`);

async function main() {
  if (env.mock) throw new Error("smoke test is pointless with MOCK=1 - set MOCK=0");
  assertLiveCredentials(false); // no agent runs here

  const scenarioId = arg("scenario") ?? (await listScenarios())[0]?.id;
  if (!scenarioId) throw new Error("no scenarios found");
  const scenario = await loadScenario(scenarioId);

  console.log(`\n  ${scenario.name}`);
  console.log(`  image: ${scenario.image ?? "Daytona default sandbox"}\n`);

  let box: SandboxHandle | undefined;
  let failures = 0;

  try {
    const t0 = Date.now();
    box = await daytonaProvider.create(scenario, "smoke");
    ok(`sandbox ${box.id} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    info(`home=${box.homeDir}  repo=${box.repoDir}`);

    // 1. Does the image have the toolchain a trial assumes?
    for (const [label, cmd] of [
      ["git", "git --version"],
      ["python", "python --version"],
      ["pip", "pip --version"],
      ["node", "node --version"],
      ["npm", "npm --version"],
    ]) {
      const r = await box.exec(cmd, { cwd: "/", timeoutSec: 60 });
      if (r.exitCode === 0) ok(`${label}: ${r.output.trim().split("\n")[0]}`);
      else {
        bad(`${label} missing - ${r.output.trim().slice(0, 160)}`);
        failures++;
      }
    }

    // 2. Clone. Runs before setup, so git must already be in the image.
    const t1 = Date.now();
    const clone = await box.exec(
      `git clone --depth 1 --branch ${scenario.ref} ${scenario.repo} ${box.repoDir}`,
      { cwd: box.homeDir, timeoutSec: 300 },
    );
    if (clone.exitCode !== 0) {
      bad(`clone failed - ${clone.output.trim().slice(0, 400)}`);
      failures++;
    } else {
      ok(`clone in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    }

    // 3. Setup.
    for (const cmd of scenario.setup) {
      const t2 = Date.now();
      const r = await box.exec(cmd, { cwd: box.repoDir, timeoutSec: 600 });
      if (r.exitCode !== 0) {
        bad(`setup failed: ${cmd}\n        ${r.output.trim().slice(0, 400)}`);
        failures++;
      } else {
        ok(`setup in ${((Date.now() - t2) / 1000).toFixed(1)}s: ${cmd}`);
      }
    }

    // 4. Inject the verifier exactly as a trial would.
    for (const f of scenario.resolvedVerifyFiles) {
      await box.writeFile(`${box.repoDir}/${f.remotePath}`, f.contents);
      ok(`injected ${f.remotePath}`);
    }

    // 4b. Resolve the agent CLI exactly as agent-runner.ts does. `npm install
    //     -g` EACCESes as the non-root sandbox user, so this must either find
    //     the preinstalled binary or fall back to a home-prefix install.
    if (scenario.agent === "claude-code") {
      const t4 = Date.now();
      const probe = await box.exec("command -v claude || true", {
        cwd: box.homeDir,
        timeoutSec: 30,
      });
      let bin = probe.output.trim().split("\n").pop()?.trim() ?? "";

      if (bin) {
        info(`agent CLI preinstalled at ${bin}`);
      } else {
        const inst = await box.exec(
          "npm install -g --prefix $HOME/.npm-global @anthropic-ai/claude-code",
          { cwd: box.homeDir, timeoutSec: 300 },
        );
        if (inst.exitCode !== 0) {
          bad(`agent CLI install failed - ${inst.output.trim().slice(-400)}`);
          failures++;
        }
        bin = `${box.homeDir}/.npm-global/bin/claude`;
      }

      const v = await box.exec(`${bin} --version`, { cwd: box.homeDir, timeoutSec: 60 });
      if (v.exitCode === 0) {
        ok(`agent CLI ${v.output.trim().split("\n")[0]} ready in ${((Date.now() - t4) / 1000).toFixed(1)}s`);
      } else {
        bad(`agent CLI not runnable - ${v.output.trim().slice(0, 200)}`);
        failures++;
      }

      // Do the flags this harness passes actually parse on this CLI version?
      // Without a key it should fail on auth, not on argument parsing.
      const flags = await box.exec(
        `${bin} -p "say ok" --permission-mode bypassPermissions --output-format text`,
        { cwd: box.repoDir, timeoutSec: 90 },
      );
      const out = flags.output.toLowerCase();
      if (/unknown option|unrecognized|invalid (option|argument|choice)/.test(out)) {
        bad(`agent CLI rejected our flags - ${flags.output.trim().slice(0, 300)}`);
        failures++;
      } else if (flags.exitCode === 0) {
        ok("agent CLI accepted our flags and ran a real turn");
      } else {
        info(`agent flags parse; CLI exited ${flags.exitCode} (expected without a key): ${flags.output.trim().slice(0, 160)}`);
      }
    }

    // 4c. Same check for aider: setup installed it, so confirm the binary
    //     runs and that the flags this harness passes still parse. Aider's
    //     CLI surface moves faster than Claude Code's, so this is the step
    //     most likely to catch a break before it costs a full run.
    if (scenario.agent === "aider") {
      const t4 = Date.now();
      const probe = await box.exec(`command -v ${AIDER_BIN} || command -v aider || true`, {
        cwd: box.homeDir,
        timeoutSec: 30,
      });
      const bin = probe.output.trim().split("\n").pop()?.trim() ?? "";

      if (!bin) {
        bad("aider not on PATH - check the venv install in scenario.setup");
        failures++;
      } else {
        const v = await box.exec(`${bin} --version`, { cwd: box.homeDir, timeoutSec: 60 });
        if (v.exitCode === 0) {
          ok(`agent CLI ${v.output.trim().split("\n")[0]} ready in ${((Date.now() - t4) / 1000).toFixed(1)}s`);
        } else {
          bad(`agent CLI not runnable - ${v.output.trim().slice(0, 200)}`);
          failures++;
        }

        // --exit makes aider start, parse everything, and quit without
        // calling the model: flag validation for zero tokens.
        const flags = await box.exec(
          `${bin} --model ${scenario.model} --yes-always --no-auto-commits --no-check-update --no-pretty --exit`,
          { cwd: box.repoDir, timeoutSec: 120 },
        );
        const out = flags.output.toLowerCase();
        if (/unknown option|unrecognized|invalid (option|argument|choice)|no such option/.test(out)) {
          bad(`agent CLI rejected our flags - ${flags.output.trim().slice(0, 300)}`);
          failures++;
        } else if (flags.exitCode === 0) {
          ok("agent CLI accepted our flags");
        } else {
          info(`agent flags parse; CLI exited ${flags.exitCode}: ${flags.output.trim().slice(0, 160)}`);
        }
      }
    }

    // 4d. goose: confirm the binary installed and that `run --instructions`
    //     still exists. There is no zero-token way to exercise a real turn,
    //     so this checks the surface the runner depends on and no more.
    if (scenario.agent === "goose") {
      const t4 = Date.now();
      const probe = await box.exec(`command -v ${GOOSE_BIN} || command -v goose || true`, {
        cwd: box.homeDir,
        timeoutSec: 30,
      });
      const bin = probe.output.trim().split("\n").pop()?.trim() ?? "";

      if (!bin) {
        bad("goose not on PATH - check the install script in scenario.setup");
        failures++;
      } else {
        const v = await box.exec(`${bin} --version`, { cwd: box.homeDir, timeoutSec: 60 });
        if (v.exitCode === 0) {
          ok(`agent CLI ${v.output.trim().split("\n")[0]} ready in ${((Date.now() - t4) / 1000).toFixed(1)}s`);
        } else {
          bad(`agent CLI not runnable - ${v.output.trim().slice(0, 200)}`);
          failures++;
        }

        const help = await box.exec(`${bin} run --help`, { cwd: box.homeDir, timeoutSec: 60 });
        if (help.exitCode === 0 && /--instructions/.test(help.output)) {
          ok("agent CLI accepts `run --instructions`");
        } else {
          bad(`goose run --instructions is gone - ${help.output.trim().slice(0, 300)}`);
          failures++;
        }
      }
    }

    // 5. THE baseline assertion. With no agent having run, verify MUST fail.
    //    If it passes here, the scenario tests nothing and every trial would
    //    report a fake 100%.
    let exitCode = 0;
    let output = "";
    const t3 = Date.now();
    for (const cmd of scenario.verify) {
      const r = await box.exec(cmd, { cwd: box.repoDir, timeoutSec: scenario.timeoutSec });
      output += r.output;
      exitCode = r.exitCode;
      if (exitCode !== 0) break;
    }
    info(`verify ran in ${((Date.now() - t3) / 1000).toFixed(1)}s, exit ${exitCode}`);

    if (exitCode === 0) {
      bad("BASELINE BROKEN: verify passes on the unmodified repo, so it proves nothing");
      failures++;
    } else {
      ok("baseline correct: verify fails before the agent touches anything");
    }
    console.log(`\n\x1b[90m${output.trim().split("\n").slice(-12).join("\n")}\x1b[0m`);
  } finally {
    await box?.destroy();
    info("sandbox destroyed");
  }

  console.log(
    failures === 0
      ? "\n  \x1b[32mReady.\x1b[0m Environment is sound; the only untested step is the agent.\n"
      : `\n  \x1b[31m${failures} problem(s).\x1b[0m Fix before running 50 trials.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\n", err);
  process.exit(1);
});
