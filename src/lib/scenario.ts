import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

/**
 * A scenario is the whole experiment definition: which repo, which task,
 * and - critically - how to decide objectively whether the agent succeeded.
 *
 * `verify` is the part people get wrong. It must be a deterministic command
 * that passes on a correct solution and fails on every wrong one, without
 * asking an LLM. If you can't write it, you can't measure reliability.
 */
export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),

  /** Repo the agent works in. Cloned fresh into every sandbox. */
  repo: z.string().url(),
  ref: z.string().default("main"),

  /**
   * Optional custom image. Leave unset to use Daytona's default sandbox, which
   * already ships git, Python 3.14, and Node 25 - enough for most scenarios.
   *
   * Naming an image here triggers a *declarative build*, which is not enabled
   * for every organization or region (it 403s with "Declarative builds are not
   * available to your organization"). Only set it if you truly need something
   * the default lacks, and smoke-test it first.
   */
  image: z.string().optional(),

  /** Run once after clone, before the agent starts. Failures here are infra_error. */
  setup: z.array(z.string()).default([]),

  /** The prompt handed to the agent-under-test. */
  task: z.string(),

  /** Deterministic pass/fail. Non-zero exit = the trial failed. */
  verify: z.array(z.string()).min(1),

  /**
   * Files copied into the sandbox *after* the agent finishes, before `verify`.
   * Keys are paths relative to the repo; values are paths relative to
   * `scenarios/`.
   *
   * This is where the verifier test lives. Shipping it in the repo instead
   * would let the agent read it, satisfy it narrowly, or delete it - at which
   * point you are measuring test-reading, not the task.
   */
  verifyFiles: z.record(z.string(), z.string()).default({}),

  /**
   * Cosmetic: file paths the simulator claims the agent touched, so the
   * MOCK=1 fallback demo names files that exist in *this* repo.
   */
  mockFiles: z.array(z.string()).default([]),

  /** Which agent to run. See src/lib/agent-runner.ts. */
  agent: z.enum(["claude-code", "shell-agent"]).default("claude-code"),

  /** Per-trial wall clock, seconds. */
  timeoutSec: z.number().int().positive().default(420),
});

export type Scenario = z.infer<typeof ScenarioSchema> & {
  /** `verifyFiles` with contents read off disk. Populated by loadScenario. */
  resolvedVerifyFiles: Array<{ remotePath: string; contents: string }>;
};

const SCENARIO_DIR = path.join(process.cwd(), "scenarios");

export async function loadScenario(id: string): Promise<Scenario> {
  const raw = await readFile(path.join(SCENARIO_DIR, `${id}.json`), "utf8");
  const parsed = ScenarioSchema.parse(JSON.parse(raw));

  // Read verifier files once, here, rather than per-trial: 50 trials would
  // otherwise mean 50 identical disk reads, and a missing file should fail
  // loudly at load time instead of 50 times as an infra_error.
  const resolvedVerifyFiles = await Promise.all(
    Object.entries(parsed.verifyFiles).map(async ([remotePath, localPath]) => ({
      remotePath,
      contents: await readFile(path.join(SCENARIO_DIR, localPath), "utf8"),
    })),
  );

  return { ...parsed, resolvedVerifyFiles };
}

export async function listScenarios(): Promise<Scenario[]> {
  // Sorted so the dropdown order is deterministic - readdir order is not, and
  // the first entry is what a demo lands on by default.
  const files = (await readdir(SCENARIO_DIR)).filter((f) => f.endsWith(".json")).sort();
  return Promise.all(files.map((f) => loadScenario(path.basename(f, ".json"))));
}
