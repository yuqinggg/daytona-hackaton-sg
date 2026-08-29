import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness check for the container platform; never exposes secret state. */
export function GET() {
  return NextResponse.json({ ok: true });
}
