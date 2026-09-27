import { badRequest, guard } from "@/lib/guard";
import { errorText, runAnalysis } from "@/lib/pipeline/analyze";
import { analyzeRequestSchema } from "@/lib/schemas";
import type { StreamEvent } from "@/lib/types";

// A full debate makes 6-8 model calls. Vercel caps this per plan; lower it if a deploy rejects the value.
export const maxDuration = 300;

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;

  const parsed = analyzeRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // Client went away; the abort signal stops the model calls.
        }
      };
      try {
        await runAnalysis(parsed.data, emit, req.signal);
      } catch (err) {
        console.error("[analyze]", err);
        emit({ type: "error", message: errorText(err) });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
