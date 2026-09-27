import { streamText } from "ai";
import { badRequest, guard } from "@/lib/guard";
import { getModel } from "@/lib/llm/providers";
import { askPrompt, askSystem } from "@/lib/prompts/document";
import { formatEvidence } from "@/lib/prompts/shared";
import { askRequestSchema } from "@/lib/schemas";

export const maxDuration = 120;

/** Grounded Q&A over PDF chunks the browser already retrieved. Streams plain text. */
export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;

  const parsed = askRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { lang, provider, question, fileName, chunks, history } = parsed.data;

  let model;
  try {
    model = getModel(provider, "main", { temperature: 0.3 });
  } catch (err) {
    return Response.json({ error: "provider_unavailable", message: String(err) }, { status: 400 });
  }

  const excerpts = formatEvidence(
    chunks.map((c) => ({ id: c.id, kind: "pdf" as const, title: `${fileName} · p.${c.page}`, page: c.page, text: c.text })),
  );

  const result = streamText({
    ...model,
    system: askSystem(fileName, lang),
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: askPrompt(excerpts, question) },
    ],
    abortSignal: req.signal,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const part of result.stream) {
          if (part.type === "text-delta") controller.enqueue(encoder.encode(part.text));
          else if (part.type === "error") throw part.error;
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[error] ${err instanceof Error ? err.message : String(err)}`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } });
}
