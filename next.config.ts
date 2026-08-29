import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The orchestrator holds long-lived state (in-flight runs, SSE subscribers)
  // in module scope. Keep it out of the bundler's transform path.
  serverExternalPackages: ["@daytona/sdk", "@anthropic-ai/sdk"],
};

export default nextConfig;
