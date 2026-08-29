import { NextResponse } from "next/server";
import { startRun } from "@/lib/orchestrator";
import { listScenarios, loadScenario } from "@/lib/scenario";
import { listArchived } from "@/lib/replay";
import { listRuns } from "@/lib/store";
import { DEFAULT_TRIALS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    runs: listRuns().map(({ trials, ...rest }) => ({ ...rest, trialCount: trials.length })),
    scenarios: await listScenarios(),
    archived: await listArchived(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const scenario = await loadScenario(body.scenarioId);
    const run = startRun({
      scenario,
      trials: body.trials ?? DEFAULT_TRIALS,
      concurrency: body.concurrency,
    });
    return NextResponse.json({ run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to start run";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
