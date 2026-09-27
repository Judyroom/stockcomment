// Related-news retrieval (Yahoo Finance, keyless) and optional Gemini web research with Google Search grounding.

import { generateText } from "ai";
import { getSearchModel } from "@/lib/llm/providers";
import { webResearchPrompt } from "@/lib/prompts/context";
import type { Evidence, Extraction, Lang, Quote } from "@/lib/types";
import { yf } from "./market";
import { googleNews, yahooSymbolNews, type FeedItem } from "./rss";

const MAX_NEWS = 8;

export interface NewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: string | null;
  tickers: string[];
}

/**
 * Yahoo headline search. Yahoo returns no news for non-US symbols such as 0700.HK,
 * so a symbol with no hits is retried with the company's English name.
 */
export async function searchNews(query: string, count = 8): Promise<NewsItem[]> {
  const items = await rawSearch(query, count);
  if (items.length || !/^[\^A-Z0-9.=-]+$/i.test(query)) return items;
  try {
    const q = await yf.quote(query.toUpperCase());
    const name = q?.longName ?? q?.shortName;
    return name ? rawSearch(name, count) : [];
  } catch {
    return [];
  }
}

async function rawSearch(query: string, count: number): Promise<NewsItem[]> {
  try {
    const res = await yf.search(query, { quotesCount: 0, newsCount: count });
    return res.news.map((n) => ({
      uuid: n.uuid,
      title: n.title,
      publisher: n.publisher,
      link: n.link,
      publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime).toISOString() : null,
      tickers: n.relatedTickers ?? [],
    }));
  } catch {
    return [];
  }
}

/**
 * Related coverage, de-duplicated and newest first:
 * per-symbol Yahoo RSS (carries article summaries) for the quoted companies, then Yahoo
 * search for the extraction's own queries. The labelling stage later scores relevance.
 */
export async function relatedNews(quotes: Quote[], extraction: Extraction): Promise<Evidence[]> {
  const symbols = quotes.filter((q) => !q.symbol.startsWith("^")).map((q) => q.symbol);
  const [feeds, searches] = await Promise.all([
    Promise.all(symbols.map((s) => yahooSymbolNews(s, 6))),
    Promise.all([...quotes.map((q) => q.name), ...extraction.searchQueries].slice(0, 4).map((q) => searchNews(q, 4))),
  ]);

  let items = dedupe([
    ...feeds.flat(),
    ...searches.flat().map((n) => ({ title: n.title, link: n.link, publisher: n.publisher, publishedAt: n.publishedAt, summary: null })),
  ]);
  // Macro stories have no symbol and Yahoo search often returns nothing for them.
  if (items.length < 3 && extraction.searchQueries.length) {
    items = dedupe([...items, ...(await googleNews(extraction.searchQueries[0], 6))]);
  }
  return toEvidence(items, "N", MAX_NEWS);
}

function dedupe(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const it of items) {
    const key = it.title.toLowerCase().replace(/\W+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

function toEvidence(items: FeedItem[], prefix: "N" | "W", max: number): Evidence[] {
  return items.slice(0, max).map((n, i) => ({
    id: `${prefix}${i + 1}`,
    kind: prefix === "N" ? "news" : "web",
    title: n.title,
    source: n.publisher ?? hostOf(n.link),
    url: n.link,
    publishedAt: n.publishedAt ?? undefined,
    text: n.summary?.slice(0, 500) || undefined,
  }));
}

export interface WebResearch {
  engine: "tavily" | "gemini" | "google-news";
  brief: string | null;
  sources: Evidence[];
}

/**
 * Web research with a fallback chain:
 * 1. Tavily when configured (free tier, 1,000 credits a month), with article snippets;
 * 2. Gemini with Google Search grounding;
 * 3. Google News RSS, keyless, headlines only.
 * Throws only if every engine fails.
 */
export async function webResearch(extraction: Extraction, lang: Lang, signal?: AbortSignal): Promise<WebResearch> {
  const engines: (() => Promise<WebResearch>)[] = [];
  if (process.env.TAVILY_API_KEY?.trim()) engines.push(() => tavilyResearch(extraction, signal));
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) engines.push(() => geminiResearch(extraction, lang, signal));
  engines.push(() => googleNewsResearch(extraction));

  const errors: string[] = [];
  for (const run of engines) {
    try {
      const r = await run();
      if (r.sources.length) return r;
      errors.push(`${r.engine}: no results`);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new Error(errors.join(" | ") || "No web search engine configured");
}

async function googleNewsResearch(extraction: Extraction): Promise<WebResearch> {
  const subjects = extraction.entities.filter((e) => e.role === "subject").map((e) => e.name);
  const queries = [subjects.join(" "), ...extraction.searchQueries].filter(Boolean).slice(0, 2);
  const batches = await Promise.all(queries.map((q) => googleNews(q, 6)));
  return { engine: "google-news", brief: null, sources: toEvidence(dedupe(batches.flat()), "W", 6) };
}

/** Tavily news search: each result becomes a citable W# item carrying its snippet. */
async function tavilyResearch(extraction: Extraction, signal?: AbortSignal): Promise<WebResearch> {
  const names = extraction.entities.filter((e) => e.role === "subject").map((e) => e.name);
  const query = [names.join(" ") || extraction.headline, extraction.eventType].join(" ").slice(0, 300);
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY!.trim()}` },
    body: JSON.stringify({ query, topic: "news", time_range: "month", max_results: 6, search_depth: "basic" }),
    signal,
  });
  if (!res.ok) throw new Error(`tavily: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    results?: { title: string; url: string; content?: string; published_date?: string }[];
  };
  const sources: Evidence[] = (data.results ?? []).map((r, i) => ({
    id: `W${i + 1}`,
    kind: "web",
    title: r.title || hostOf(r.url),
    source: hostOf(r.url),
    url: r.url,
    publishedAt: r.published_date ? safeIso(r.published_date) : undefined,
    text: r.content?.slice(0, 600),
  }));
  return { engine: "tavily", brief: null, sources };
}

/**
 * Gemini with Google Search grounding. Returns a brief whose sentences carry [W#] markers
 * pointing at the grounding sources, plus one evidence item per source.
 */
async function geminiResearch(extraction: Extraction, lang: Lang, signal?: AbortSignal): Promise<WebResearch> {
  const { model, tools } = getSearchModel();
  const result = await generateText({
    model,
    tools,
    prompt: webResearchPrompt(extraction, lang),
    abortSignal: signal,
    // Search grounding has its own, often much smaller, quota; a 429 here will not clear on retry.
    maxRetries: 0,
  });

  const urlSources = result.sources.filter((s) => s.sourceType === "url");
  const sources: Evidence[] = urlSources.map((s, i) => ({
    id: `W${i + 1}`,
    kind: "web",
    title: s.title || hostOf(s.url),
    source: hostOf(s.url),
    url: s.url,
  }));

  let brief = result.text;
  const google = result.providerMetadata?.google as
    | { groundingMetadata?: { groundingSupports?: GroundingSupport[] | null } | null }
    | undefined;
  for (const support of google?.groundingMetadata?.groundingSupports ?? []) {
    const segment = support.segment?.text;
    const ids = (support.groundingChunkIndices ?? []).filter((i) => i < sources.length);
    if (!segment || !ids.length || !brief.includes(segment)) continue;
    brief = brief.replace(segment, `${segment} [${ids.map((i) => `W${i + 1}`).join(", ")}]`);
  }
  return { engine: "gemini", brief, sources };
}

interface GroundingSupport {
  segment?: { text?: string | null } | null;
  groundingChunkIndices?: number[] | null;
}

function safeIso(date: string) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
