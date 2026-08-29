import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker/container hosts need a self-contained Node server. Vercel uses its
  // own output and ignores this; setting it there can break the build.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // The orchestrator holds long-lived state (in-flight runs, SSE subscribers)
  // in module scope. Keep it out of the bundler's transform path.
  serverExternalPackages: ["@daytona/sdk", "@anthropic-ai/sdk"],
};

export default nextConfig;
