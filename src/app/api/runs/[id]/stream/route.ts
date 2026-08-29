import { getRun, subscribe } from "@/lib/store";
import type { RunEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * SSE feed for one run. Sends a full snapshot on connect so a late-joining
 * browser (or a refresh two minutes into the demo) renders the correct grid
 * immediately, then streams deltas.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return new Response("not found", { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RunEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          unsubscribe();
        }
      };

      send({ type: "run:snapshot", run });
      unsubscribe = subscribe(id, (event) => {
        send(event);
        if (event.type === "run:done") {
          unsubscribe();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      });
    },
    cancel() {
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
