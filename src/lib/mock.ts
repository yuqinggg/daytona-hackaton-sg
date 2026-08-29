import { env } from "./env";
import type { Scenario } from "./scenario";
import type { ExecResult, SandboxHandle, SandboxProvider } from "./sandbox";

/**
 * Simulated provider. Same interface, plausible timings, a realistic mix of
 * failure modes. Two jobs:
 *   1. Build the UI without burning sandbox quota or API credits.
 *   2. Be the demo fallback when the conference wifi dies. `MOCK=1` and the
 *      show goes on - just say out loud that it's simulated.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (base: number, spread: number) => base + Math.random() * spread;

/**
 * Weighted outcomes, tuned to look like a real mid-quality agent.
 *
 * `files` matters as much as the log text: the classifier treats an empty diff
 * as `no_changes` before it looks at anything else, so an outcome that forgets
 * to list files silently masquerades as "the agent did nothing".
 *
 * Paths come from the scenario's `mockFiles` so the fallback demo names files
 * that exist in the repo actually on screen.
 */
interface MockOutcome {
  weight: number;
  exitCode: number;
  output: string;
  files: string[];
}

function outcomesFor(scenario: Scenario): MockOutcome[] {
  const touched = scenario.mockFiles.length ? scenario.mockFiles : ["src/main.py"];
  const primary = touched[0];

  return [
    { weight: 62, exitCode: 0, output: "5 passed in 0.07s", files: touched },
    {
      weight: 14,
      exitCode: 1,
      output: `ModuleNotFoundError: No module named 'humanize'\n  File "${primary}", line 12, in <module>\nERROR: collection failure`,
      files: [primary],
    },
    {
      weight: 9,
      exitCode: 1,
      output: `FAILED ${primary}::test_boundaries_mirror_the_thousands_logic\nE  AssertionError: assert '1.0M' == '1000k'\n\n1 failed, 4 passed`,
      files: touched,
    },
    {
      weight: 6,
      exitCode: 1,
      output: `SyntaxError: invalid syntax (${primary}, line 287)`,
      files: [primary],
    },
    {
      weight: 5,
      exitCode: 1,
      output: "No changes detected in working tree. Agent produced no diff.",
      files: [],
    },
    {
      weight: 4,
      exitCode: 124,
      output: "Trial exceeded wall clock; killed.",
      files: [primary],
    },
  ];
}

function pickOutcome(outcomes: MockOutcome[]) {
  const total = outcomes.reduce((s, o) => s + o.weight, 0);
  let roll = Math.random() * total;
  for (const o of outcomes) {
    roll -= o.weight;
    if (roll <= 0) return o;
  }
  return outcomes[0];
}

export const mockProvider: SandboxProvider = {
  async create(scenario: Scenario, label: string): Promise<SandboxHandle> {
    await sleep(jitter(700, 1400)); // provisioning feels like provisioning
    const outcome = pickOutcome(outcomesFor(scenario));

    // Match the verify step by exact command, not by pattern. Substring
    // matching bit once already: aider's setup line is
    // `pip install ... pytest ...`, so a /pytest/ test fired the predetermined
    // outcome during *setup*, turning every simulated failure into an
    // infra_error and reporting a fake 100% success rate.
    const verifyCommands = new Set(scenario.verify);

    return {
      id: `mock-${label}`,
      homeDir: "/home/daytona",
      repoDir: "/home/daytona/repo",
      async exec(command): Promise<ExecResult> {
        // The diff query has to answer honestly for this outcome, or every
        // failure classifies as `no_changes`.
        if (command.startsWith("git diff")) {
          return { exitCode: 0, output: outcome.files.join("\n") };
        }
        // Setup and agent steps take time but mostly succeed; the verify
        // command is where the predetermined outcome surfaces.
        if (verifyCommands.has(command)) {
          await sleep(jitter(1500, 2500));
          return outcome;
        }
        if (command.startsWith("__agent__")) {
          await sleep(jitter(3000, 6000));
          return { exitCode: 0, output: "agent finished" };
        }
        await sleep(jitter(300, 800));
        return { exitCode: 0, output: "" };
      },
      async writeFile() {},
      async destroy() {
        await sleep(200);
      },
    };
  },
};

export function provider() {
  return env.mock ? mockProvider : undefined;
}
