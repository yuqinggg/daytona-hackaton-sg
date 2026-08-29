import { NextResponse } from "next/server";
import { startReplay } from "@/lib/replay";

export const dynamic = "force-dynamic";

/**
 * Replays an archived run. Needs no credentials and spends nothing - which is
 * the point: it works when the wifi, the quota, or the provider does not.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) throw new Error("no archived run id given");
    const run = await startReplay(body.id, body.durationMs);
    return NextResponse.json({ run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "replay failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
