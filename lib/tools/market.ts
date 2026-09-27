// Market data via Yahoo Finance (unofficial, keyless). Covers US, HK (0700.HK), A-shares (600519.SS) and indices.

import YahooFinance from "yahoo-finance2";
import type { Entity, Quote } from "@/lib/types";

export const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const HISTORY_DAYS = 90;
const MAX_QUOTES = 3;

/**
 * Turn extracted entities into up to three verified Yahoo symbols: the story's subjects first,
 * then one benchmark index for context. Brokers and sources mentioned in passing are skipped
 * unless nothing else is tradable.
 */
export async function resolveSymbols(entities: Entity[]): Promise<string[]> {
  const tradable = entities
    .filter((e) => e.type === "company" || e.type === "index")
    .sort((a, b) => b.confidence - a.confidence);
  const subjects = tradable.filter((e) => e.role === "subject");
  const benchmark = tradable.find((e) => e.role === "mentioned" && e.type === "index");
  const candidates = subjects.length ? [...subjects, ...(benchmark ? [benchmark] : [])] : tradable;

  const symbols: string[] = [];
  for (const entity of candidates) {
    if (symbols.length >= MAX_QUOTES) break;
    const symbol = (await verifySymbol(entity.ticker)) ?? (await searchSymbol(entity.name));
    if (symbol && !symbols.includes(symbol)) symbols.push(symbol);
  }
  return symbols;
}

async function verifySymbol(ticker: string | null): Promise<string | null> {
  if (!ticker) return null;
  try {
    const q = await yf.quote(ticker.toUpperCase());
    return q?.regularMarketPrice != null ? q.symbol : null;
  } catch {
    return null;
  }
}

async function searchSymbol(name: string): Promise<string | null> {
  try {
    const res = await yf.search(name, { quotesCount: 5, newsCount: 0 });
    const hit = res.quotes.find(
      (q) => "symbol" in q && (q.quoteType === "EQUITY" || q.quoteType === "INDEX" || q.quoteType === "ETF"),
    );
    return hit && "symbol" in hit ? String(hit.symbol) : null;
  } catch {
    return null;
  }
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  // Fetch from Jan 1 (or 90 days back, whichever is earlier) so year-to-date moves can be checked
  // against stale figures in the source text; only the last 90 days are kept for the chart.
  const ninetyDaysAgo = Date.now() - HISTORY_DAYS * 86_400_000;
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const period1 = new Date(Math.min(ninetyDaysAgo, yearStart));
  const results = await Promise.all(
    symbols.map(async (symbol): Promise<Quote | null> => {
      try {
        const [q, chart] = await Promise.all([
          yf.quote(symbol),
          yf.chart(symbol, { period1, interval: "1d" }).catch(() => null),
        ]);
        if (!q) return null;
        const closes = (chart?.quotes ?? [])
          .filter((p) => p.close != null)
          .map((p) => ({ t: new Date(p.date).getTime(), c: Number(p.close) }));
        const ytdBase = closes.find((p) => p.t >= yearStart)?.c;
        return {
          symbol: q.symbol,
          name: q.shortName ?? q.longName ?? q.symbol,
          price: q.regularMarketPrice ?? null,
          currency: q.currency ?? null,
          changePct: q.regularMarketChangePercent ?? null,
          marketCap: q.marketCap ?? null,
          pe: q.trailingPE ?? null,
          high52: q.fiftyTwoWeekHigh ?? null,
          low52: q.fiftyTwoWeekLow ?? null,
          exchange: q.fullExchangeName ?? null,
          ytdPct: ytdBase && q.regularMarketPrice ? (q.regularMarketPrice / ytdBase - 1) * 100 : null,
          history: closes.filter((p) => p.t >= ninetyDaysAgo),
        };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((q): q is Quote => q !== null);
}

/** Compact, model-readable summary of quotes, including simple trend stats for the technician persona. */
export function describeQuotes(quotes: Quote[]): string {
  if (!quotes.length) return "No market data available.";
  return quotes
    .map((q) => {
      const h = q.history;
      const first = h[0]?.c;
      const last = h.at(-1)?.c;
      const ret90 = first && last ? ((last / first - 1) * 100).toFixed(1) : "n/a";
      const ma20 = h.length >= 20 ? avg(h.slice(-20).map((p) => p.c)).toFixed(2) : "n/a";
      const ma50 = h.length >= 50 ? avg(h.slice(-50).map((p) => p.c)).toFixed(2) : "n/a";
      const lo = h.length ? Math.min(...h.map((p) => p.c)).toFixed(2) : "n/a";
      const hi = h.length ? Math.max(...h.map((p) => p.c)).toFixed(2) : "n/a";
      return [
        `${q.symbol} (${q.name}, ${q.exchange ?? "?"})`,
        `price ${fmt(q.price)} ${q.currency ?? ""}, day ${fmt(q.changePct)}%, year-to-date ${fmt(q.ytdPct)}%`,
        `90d return ${ret90}%, 90d range ${lo}-${hi}, MA20 ${ma20}, MA50 ${ma50}`,
        `52w range ${fmt(q.low52)}-${fmt(q.high52)}, trailing P/E ${fmt(q.pe)}, market cap ${q.marketCap ? (q.marketCap / 1e9).toFixed(1) + "B" : "n/a"}`,
      ].join("; ");
    })
    .join("\n");
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const fmt = (n: number | null) => (n == null ? "n/a" : n.toFixed(2));
