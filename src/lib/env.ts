function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  daytonaApiKey: process.env.DAYTONA_API_KEY ?? "",
  daytonaApiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
  daytonaTarget: process.env.DAYTONA_TARGET || "us",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  /**
   * Required only for identity-linked API keys, which reject every request
   * with "anthropic-workspace-id is required when authenticating with an
   * identity-linked API key". Harmless to leave unset for ordinary keys.
   */
  anthropicWorkspaceId: process.env.ANTHROPIC_WORKSPACE_ID ?? "",
  concurrency: num(process.env.RELIABILITY_CONCURRENCY, 8),
  trialTimeoutSec: num(process.env.RELIABILITY_TRIAL_TIMEOUT, 420),
  /** Simulated backend: no Daytona, no spend, same UI. Demo fallback. */
  mock: process.env.MOCK === "1" || process.env.MOCK === "true",
};

/**
 * Aider goes in its own venv rather than the sandbox's system Python. The
 * scenario repo installs its own pinned test dependencies (aider itself pins
 * rich and packaging), and letting pip resolve both sets together would let
 * the agent's installer break the verifier's interpreter - a harness bug that
 * would show up as an agent failure.
 */
export const AIDER_VENV = "$HOME/.aider-venv";
export const AIDER_BIN = `${AIDER_VENV}/bin/aider`;

/** Where goose's official install script puts the binary. */
export const GOOSE_BIN = "$HOME/.local/bin/goose";

/**
 * Model-provider keys forwarded into every sandbox, whichever are set.
 *
 * The agent-under-test picks its own provider, so the harness must not hard-
 * code one: an allowlist keeps unrelated host environment out of the sandbox
 * while letting a scenario point at any provider its agent supports.
 */
export const AGENT_PROVIDER_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
] as const;

export function agentProviderEnv(): Record<string, string> {
  return Object.fromEntries(
    AGENT_PROVIDER_KEYS.map((k) => [k, process.env[k] ?? ""]).filter(([, v]) => v),
  );
}

/**
 * @param needsAgentKey - false for checks that never run the agent (the
 * environment pre-flight), so a missing Anthropic key doesn't block the one
 * test that could still tell you something useful.
 */
export function assertLiveCredentials(needsAgentKey = true) {
  if (env.mock) return;
  const missing: string[] = [];
  if (!env.daytonaApiKey) missing.push("DAYTONA_API_KEY");
  // Any provider key will do - which one is right depends on scenario.model.
  if (needsAgentKey && Object.keys(agentProviderEnv()).length === 0) {
    missing.push(`one of ${AGENT_PROVIDER_KEYS.join(", ")}`);
  }
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(", ")}. Set them in .env.local, or run with MOCK=1.`,
    );
  }
}
