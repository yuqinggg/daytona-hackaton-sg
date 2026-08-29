/**
 * Free-tier budget check. Answers one question before you spend anything:
 * how many trials can this key still afford today?
 *
 *   npm run budget
 *   npm run budget -- --agent goose --trials 10
 *
 * On a free tier the scarce resource is *requests*, not dollars or sandboxes.
 * One trial is not one request: an agent loop makes a model call per turn, so
 * a tool-using agent costs an order of magnitude more of the daily allowance
 * than a one-shot one. Getting this wrong means a run that dies half-finished
 * and a day's quota spent on an unusable number.
 */
import "../lib/load-env";

/** OpenRouter's published free-model caps (docs/api-reference/limits). */
const FREE_RPM = 20;
const FREE_RPD_NO_CREDITS = 50;
const FREE_RPD_WITH_CREDITS = 1000;
const CREDITS_THRESHOLD = 10;

/**
 * Model calls per trial, measured in requests rather than tokens.
 *
 * Aider is one-shot: a repo-map turn plus an edit turn, occasionally a retry
 * when its edit block does not apply. goose runs a full tool loop - read,
 * think, edit, re-read - and every turn is another request. These are
 * estimates; `--measured` overrides them once you have a real run to count.
 */
const REQUESTS_PER_TRIAL: Record<string, number> = {
  aider: 4,
  goose: 20,
  "claude-code": 25,
  "shell-agent": 1,
};

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const g = (s: string) => `\x1b[32m${s}\x1b[0m`;
const r = (s: string) => `\x1b[31m${s}\x1b[0m`;
const y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[90m${s}\x1b[0m`;

async function main() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.log(r("\n  OPENROUTER_API_KEY is not set.\n"));
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${key}` };
  const [keyRes, creditRes] = await Promise.all([
    fetch("https://openrouter.ai/api/v1/key", { headers }).then((x) => x.json()),
    fetch("https://openrouter.ai/api/v1/credits", { headers }).then((x) => x.json()),
  ]);

  const purchased: number = creditRes?.data?.total_credits ?? 0;
  const usedToday: number = keyRes?.data?.usage_daily ?? 0;
  const rpd = purchased >= CREDITS_THRESHOLD ? FREE_RPD_WITH_CREDITS : FREE_RPD_NO_CREDITS;
  const remaining = Math.max(0, rpd - usedToday);

  console.log(`\n  ${dim("credits purchased")}  $${purchased.toFixed(2)}`);
  console.log(`  ${dim("free-model cap   ")}  ${rpd} requests/day, ${FREE_RPM}/min`);
  console.log(`  ${dim("used today       ")}  ${usedToday}`);
  console.log(`  ${dim("remaining today  ")}  ${remaining > 0 ? g(String(remaining)) : r("0")}\n`);

  const agent = arg("agent");
  const agents = agent ? [agent] : Object.keys(REQUESTS_PER_TRIAL).filter((a) => a !== "shell-agent");
  const wanted = Number(arg("trials", "10"));

  for (const a of agents) {
    const per = REQUESTS_PER_TRIAL[a];
    if (!per) {
      console.log(r(`  unknown agent: ${a}`));
      continue;
    }
    const affordable = Math.floor(remaining / per);
    const need = wanted * per;
    const verdict =
      affordable >= wanted
        ? g(`can run ${wanted}`)
        : affordable > 0
          ? y(`only ${affordable} of ${wanted}`)
          : r("cannot run today");

    console.log(
      `  ${a.padEnd(12)} ~${String(per).padStart(2)} req/trial   ` +
        `${String(need).padStart(4)} req for ${wanted}   ${verdict}`,
    );
  }

  // The per-minute cap is what decides concurrency: N agents in flight each
  // calling the model every few seconds will breach 20/min long before the
  // daily cap runs out, and every breach is a wasted sandbox.
  console.log(
    `\n  ${dim("suggested")} RELIABILITY_CONCURRENCY=${remaining > 200 ? 6 : 2}` +
      dim(`  (${FREE_RPM} req/min is the ceiling that matters here)`),
  );
  console.log(dim("\n  Estimates, not measurements. Count real requests at"));
  console.log(dim("  https://openrouter.ai/activity after your first run.\n"));
}

main().catch((err) => {
  console.error("\n", err);
  process.exit(1);
});
