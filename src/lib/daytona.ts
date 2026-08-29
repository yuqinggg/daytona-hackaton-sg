import { Daytona } from "@daytona/sdk";
import { agentProviderEnv, env } from "./env";
import type { Scenario } from "./scenario";
import type { ExecResult, SandboxHandle, SandboxProvider } from "./sandbox";

/**
 * Live Daytona provider.
 *
 * The calls below are checked against the installed @daytona/sdk typings
 * (`create({image, envVars, labels})`, `process.executeCommand(cmd, cwd, env,
 * timeoutSec)`, `fs.uploadFile(Buffer, remotePath)`, `sandbox.delete()`).
 * Still smoke-test one real trial before the demo - a wrong assumption here
 * fails all 50 trials identically, which on stage looks like a product bug:
 *
 *   npm run bench -- --trials 1
 */

let client: Daytona | null = null;

function daytona(): Daytona {
  if (!client) {
    client = new Daytona({
      apiKey: env.daytonaApiKey,
      apiUrl: env.daytonaApiUrl,
      target: env.daytonaTarget,
    });
  }
  return client;
}

/**
 * Capacity errors are not trial outcomes.
 *
 * Daytona caps concurrent sandboxes per organization (this account: 10). When
 * the pool asks for one too many, `create` throws instantly - and without this,
 * that instantly *consumed a trial* as an infra error. A 50-trial run at
 * concurrency 12 produced 10 real measurements and 40 sub-second errors that
 * cascaded through the whole queue.
 *
 * Waiting is the correct response: a slot is about to free up.
 */
function isCapacityError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /cpu limit|limit exceeded|quota|too many|rate.?limit|429/i.test(m);
}

const MAX_CAPACITY_WAITS = 40;

export const daytonaProvider: SandboxProvider = {
  async create(scenario: Scenario, label: string): Promise<SandboxHandle> {
    // The agent-under-test needs its own credentials inside the box.
    const base = {
      envVars: {
        ...agentProviderEnv(),
        // Identity-linked keys need a workspace on every request. Set both:
        // the SDK reads ANTHROPIC_WORKSPACE_ID, and ANTHROPIC_CUSTOM_HEADERS
        // is the escape hatch the CLI honours regardless of SDK version.
        ...(env.anthropicWorkspaceId
          ? {
              ANTHROPIC_WORKSPACE_ID: env.anthropicWorkspaceId,
              ANTHROPIC_CUSTOM_HEADERS: `anthropic-workspace-id: ${env.anthropicWorkspaceId}`,
            }
          : {}),
        RELIABILITY_TRIAL: label,
        // Stops interactive prompts from hanging a trial forever.
        CI: "true",
        DEBIAN_FRONTEND: "noninteractive",
      },
      labels: { project: "reliability-report-card", trial: label },
    };

    // No image -> the default snapshot. Passing `image` at all asks Daytona to
    // build one, which many orgs are not entitled to do.
    const provision = () =>
      scenario.image
        ? daytona().create({ ...base, image: scenario.image })
        : daytona().create(base);

    let sandbox;
    for (let attempt = 1; ; attempt++) {
      try {
        sandbox = await provision();
        break;
      } catch (err) {
        if (!isCapacityError(err) || attempt >= MAX_CAPACITY_WAITS) throw err;
        // Linear backoff to 10s, plus jitter so freed slots aren't stampeded.
        const wait = Math.min(1500 * attempt, 10000) + Math.random() * 750;
        await new Promise((r) => setTimeout(r, wait));
      }
    }

    // One extra round trip per sandbox, to avoid hardcoding a path that
    // differs between images. fs.uploadFile takes a literal path with no shell
    // expansion, so "$HOME/..." cannot be deferred to the remote side.
    const homeProbe = await sandbox.process.executeCommand("echo $HOME", undefined, undefined, 30);
    const homeDir = (homeProbe.result ?? "").trim() || "/home/daytona";
    const repoDir = `${homeDir}/repo`;

    return {
      id: sandbox.id,
      homeDir,
      repoDir,

      async exec(command, opts): Promise<ExecResult> {
        const res = await sandbox.process.executeCommand(
          command,
          opts?.cwd ?? repoDir,
          undefined,
          opts?.timeoutSec ?? scenario.timeoutSec,
        );
        return { exitCode: res.exitCode ?? 0, output: res.result ?? "" };
      },

      async writeFile(path, contents) {
        await sandbox.fs.uploadFile(Buffer.from(contents, "utf8"), path);
      },

      async destroy() {
        // Always best-effort. A leaked sandbox costs money; a throw here
        // would mask the real failure the trial was reporting.
        try {
          await sandbox.delete();
        } catch {
          /* ignore */
        }
      },
    };
  },
};
