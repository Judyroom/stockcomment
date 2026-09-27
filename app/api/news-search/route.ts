import { Output, generateText } from "ai";
import { z } from "zod";
import { badRequest, guard } from "@/lib/guard";
import { capabilities, getModel } from "@/lib/llm/providers";
import { newsSearchRequestSchema } from "@/lib/schemas";
import { searchNews } from "@/lib/tools/news";

/** Keyword / ticker headline search for the "Search news" input mode. */
export async function POST(req: Request) {
  const blocked = guard(req, 0);
  if (blocked) return blocked;
  const parsed = newsSearchRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);

  let query = parsed.data.query.trim();
  // Yahoo rejects non-ASCII queries, so translate names like 腾讯 into an English name or ticker first.
  if (/[^\x00-\x7F]/.test(query)) {
    const provider = (["deepseek", "gemini"] as const).find((p) => capabilities().providers[p]);
    if (!provider) return Response.json({ error: "ascii_only" }, { status: 400 });
    try {
      const { output } = await generateText({
        ...getModel(provider, "fast", { structured: true }),
        output: Output.object({ schema: z.object({ query: z.string() }) }),
        prompt: `Convert this search term into the English company name or Yahoo Finance ticker that finds its news on Yahoo Finance. Return only that term.\nTerm: ${query}`,
      });
      query = output.query;
    } catch {
      return Response.json({ error: "ascii_only" }, { status: 400 });
    }
  }
  return Response.json({ query, items: await searchNews(query, 10) });
}
