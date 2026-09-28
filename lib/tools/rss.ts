// Keyless news feeds.
// - Yahoo Finance per-symbol RSS: recent articles for one ticker (US, HK, ...), with a real summary.
// - Google News RSS search: any topic, including macro stories; titles and publishers only.

export interface FeedItem {
  title: string;
  link: string;
  publisher: string | null;
  publishedAt: string | null;
  summary: string | null;
}

const UA = { "User-Agent": "Mozilla/5.0 (compatible; StockCommentaryStudio/2.0)" };

export async function yahooSymbolNews(symbol: string, count = 10): Promise<FeedItem[]> {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  return (await fetchFeed(url)).slice(0, count);
}

const GOOGLE_LOCALE = {
  en: "hl=en-US&gl=US&ceid=US:en",
  zh: "hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
};

export async function googleNews(query: string, count = 10, days = 7, locale: "en" | "zh" = "en"): Promise<FeedItem[]> {
  const q = encodeURIComponent(`${query} when:${days}d`);
  const items = await fetchFeed(`https://news.google.com/rss/search?q=${q}&${GOOGLE_LOCALE[locale]}`);
  // Google appends " - Publisher" to titles and its description is only a link back to itself.
  return items.slice(0, count).map((it) => {
    const cut = it.publisher ? it.title.lastIndexOf(` - ${it.publisher}`) : -1;
    return { ...it, title: cut > 0 ? it.title.slice(0, cut) : it.title, summary: null };
  });
}

async function fetchFeed(url: string): Promise<FeedItem[]> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    return parseRss(await res.text());
  } catch {
    return [];
  }
}

export function parseRss(xml: string): FeedItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const block = m[1];
    const tag = (name: string) => {
      const hit = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
      return hit ? clean(hit[1]) : null;
    };
    const date = tag("pubDate");
    const parsed = date ? new Date(date) : null;
    return {
      title: tag("title") ?? "",
      link: tag("link") ?? "",
      publisher: tag("source"),
      publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
      summary: tag("description"),
    };
  }).filter((it) => it.title && it.link);
}

function clean(s: string) {
  return decode(s.replace(/<!\[CDATA\[|\]\]>/g, ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decode(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
