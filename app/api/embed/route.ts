import { embedMany } from "ai";
import { badRequest, guard } from "@/lib/guard";
import { capabilities, getEmbeddingModel } from "@/lib/llm/providers";
import { embedRequestSchema } from "@/lib/schemas";

export const maxDuration = 60;

/** Embeds PDF chunks or queries for the browser-side retriever. Vectors are not stored server-side. */
export async function POST(req: Request) {
  // Embedding calls are cheap; count a batch as one request.
  const blocked = guard(req);
  if (blocked) return blocked;
  if (!capabilities().embeddings) return Response.json({ error: "embeddings_unavailable" }, { status: 400 });

  const parsed = embedRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    const { model, providerOptions } = getEmbeddingModel(parsed.data.task);
    const { embeddings } = await embedMany({ model, values: parsed.data.texts, providerOptions, abortSignal: req.signal });
    return Response.json({ embeddings });
  } catch (err) {
    console.error("[embed]", err);
    return Response.json({ error: "embed_failed", message: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
