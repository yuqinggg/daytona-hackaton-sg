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
 * @param needsAgentKey - false for checks that never run the agent (the
 * environment pre-flight), so a missing Anthropic key doesn't block the one
 * test that could still tell you something useful.
 */
export function assertLiveCredentials(needsAgentKey = true) {
  if (env.mock) return;
  const missing: string[] = [];
  if (!env.daytonaApiKey) missing.push("DAYTONA_API_KEY");
  if (needsAgentKey && !env.anthropicApiKey) missing.push("ANTHROPIC_API_KEY");
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(", ")}. Set them in .env.local, or run with MOCK=1.`,
    );
  }
}
