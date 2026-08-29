/**
 * Headless runner. The insurance policy: if Next.js, the browser, or the
 * projector betrays you, this prints the same report card to a terminal.
 *
 *   npm run bench -- --scenario express-add-endpoint --trials 50
 *   MOCK=1 npm run bench -- --trials 20
 */
import "../lib/load-env";
import { loadScenario, listScenarios } from "../lib/scenario";
import { startRun } from "../lib/orchestrator";
import { modeLabel } from "../lib/labels";
import { getRun, subscribe } from "../lib/store";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const scenarioId = arg("scenario") ?? (await listScenarios())[0]?.id;
  if (!scenarioId) throw new Error("No scenarios found in ./scenarios");

  const scenario = await loadScenario(scenarioId);
  const trials = Number(arg("trials", "50"));
  const concurrency = arg("concurrency") ? Number(arg("concurrency")) : undefined;

  console.log(`\n  ${scenario.name}\n  ${trials} trials\n`);

  const run = startRun({ scenario, trials, concurrency });

  await new Promise<void>((resolve) => {
    subscribe(run.id, (event) => {
      if (event.type === "trial:update") {
        const t = event.trial;
        if (t.status === "passed") process.stdout.write("\x1b[32m.\x1b[0m");
        else if (t.status === "failed") process.stdout.write("\x1b[31mx\x1b[0m");
        else if (t.status === "errored") process.stdout.write("\x1b[33m?\x1b[0m");
      }
      if (event.type === "run:done") resolve();
    });
  });

  const finished = getRun(run.id);
  const report = finished?.report;
  if (!report) return;

  // Small runs are diagnostic runs - show what actually happened, not just a
  // rate. A 1-trial "0%" with no log is useless.
  const verbose = process.argv.includes("--verbose") || trials <= 3;
  if (verbose) {
    for (const t of finished!.trials) {
      console.log(`\n\n  --- trial #${t.index} (${t.status}) ---`);
      console.log(`  reason: ${t.reason ?? "-"}`);
      console.log(`  files changed: ${t.filesChanged?.join(", ") || "(none)"}`);
      console.log(`  log:\n${(t.logTail ?? "(empty)").split("\n").map((l) => "    " + l).join("\n")}`);
    }
  }

  console.log(`\n\n  ${report.headline}\n`);
  console.log(`  passed ${report.passed}   failed ${report.failed}   errored ${report.errored}`);
  console.log(`  median duration ${(report.medianDurationMs / 1000).toFixed(1)}s\n`);
  for (const b of report.buckets) {
    console.log(`  ${String(b.count).padStart(3)}  ${modeLabel(b.mode).padEnd(38)} ${b.exemplar}`);
  }
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
