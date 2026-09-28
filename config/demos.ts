// Built-in demo cases, one set per input mode. Their inputs are real, dated material collected
// when `npm run demos` is run (headlines from Yahoo Finance / Google News, or a public PDF), and
// their full results are stored in public/demos/<id>.<lang>.json, so opening a demo costs no tokens.

import type { AnalyzeRequest } from "@/lib/schemas";
import type { Lang } from "@/lib/types";

interface DemoBase {
  id: string;
  label: Record<Lang, string>;
  /** The symbol the story is about, used by the eval script. null for macro stories. */
  primaryTicker: string | null;
  settings: AnalyzeRequest["settings"];
}

/** "News text" tab: a few recent headlines with summaries pasted as one text. */
export interface TextDemo extends DemoBase {
  kind: "text";
  /** Yahoo Finance / Google News query used to collect the input headlines. */
  query: string;
  /** Only headlines matching this are used, so the input stays on topic. */
  mustInclude: RegExp;
}

/** "Search news" tab: three headlines picked from a Google News search, as a user would. */
export interface SearchDemo extends DemoBase {
  kind: "search";
  query: string;
  locale: Lang;
  /** Headlines must match this and come from these publishers, newest first. */
  mustInclude: RegExp;
  publishers: string[];
}

/** "PDF report" tab: a public document. The PDF itself is not redistributed; results link to the source. */
export interface PdfDemo extends DemoBase {
  kind: "pdf";
  sourceUrl: string;
  fileName: string;
  docTitle: string;
  publisher: string;
  /** Publication date of the document, YYYY-MM-DD. */
  docDate: string;
  /** Questions answered ahead of time to demo "Ask the document". */
  questions: Record<Lang, string[]>;
}

export type DemoSpec = TextDemo | SearchDemo | PdfDemo;
export type DemoKind = DemoSpec["kind"];

const debate = (bullPersona: string | null, bearPersona: string | null): AnalyzeRequest["settings"] => ({
  mode: "debate",
  strength: "moderate",
  bullPersona,
  bearPersona,
  rebuttal: true,
});

export const DEMOS: DemoSpec[] = [
  {
    kind: "text",
    id: "tesla",
    label: { en: "Tesla deliveries", zh: "特斯拉交付" },
    query: "Tesla deliveries",
    mustInclude: /tesla/i,
    primaryTicker: "TSLA",
    settings: debate("growth_seeker", "value_investor"),
  },
  {
    kind: "text",
    id: "nvidia",
    label: { en: "Nvidia · 3 analysts", zh: "英伟达 · 三位分析师" },
    query: "Nvidia stock",
    mustInclude: /nvidia/i,
    primaryTicker: "NVDA",
    settings: { mode: "single", stance: "neutral", strength: "moderate", personas: ["value_investor", "growth_seeker", "market_technician"] },
  },
  {
    kind: "text",
    id: "tencent",
    label: { en: "Tencent (HK)", zh: "腾讯（港股）" },
    query: "Tencent",
    mustInclude: /tencent/i,
    primaryTicker: "0700.HK",
    settings: debate("contrarian_thinker", "macro_visionary"),
  },
  {
    kind: "text",
    id: "fed",
    label: { en: "Fed & rates", zh: "美联储与利率" },
    query: "Federal Reserve interest rates",
    mustInclude: /fed|federal reserve|rate|powell|inflation/i,
    primaryTicker: null,
    settings: debate("macro_visionary", "contrarian_thinker"),
  },
  {
    kind: "search",
    id: "meta-muse",
    label: { en: "Meta · Muse AI agent", zh: "Meta · Muse AI 助手" },
    query: "Meta Muse AI agent",
    locale: "en",
    mustInclude: /muse/i,
    publishers: ["Fortune", "CNBC", "Yahoo Finance"],
    primaryTicker: "META",
    settings: debate("growth_seeker", "contrarian_thinker"),
  },
  {
    kind: "search",
    id: "tencent-workbuddy",
    label: { en: "Tencent · WorkBuddy", zh: "腾讯 · WorkBuddy" },
    query: "腾讯 WorkBuddy",
    locale: "zh",
    mustInclude: /WorkBuddy/i,
    publishers: ["21财经", "观点网", "华尔街见闻"],
    primaryTicker: "0700.HK",
    settings: debate("growth_seeker", "value_investor"),
  },
  {
    kind: "pdf",
    id: "meta-q2-2026",
    label: { en: "Meta Q2 2026 results", zh: "Meta 2026 年 Q2 财报" },
    sourceUrl: "https://s21.q4cdn.com/399680738/files/doc_news/Meta-Reports-Second-Quarter-2026-Results-2026.pdf",
    fileName: "Meta-Reports-Second-Quarter-2026-Results.pdf",
    docTitle: "Meta Reports Second Quarter 2026 Results",
    publisher: "Meta Investor Relations",
    docDate: "2026-07-29",
    questions: {
      zh: ["本季度营收增长的主要驱动因素是什么？", "成本和费用为什么大幅上升？", "公司对第三季度和全年给出了什么指引？"],
      en: [
        "What drove revenue growth this quarter?",
        "Why did costs and expenses rise so much?",
        "What guidance did the company give for Q3 and the full year?",
      ],
    },
    primaryTicker: "META",
    settings: debate("growth_seeker", "value_investor"),
  },
];

export const demosOfKind = (kind: DemoKind) => DEMOS.filter((d) => d.kind === kind);

export const DEMO_LANGS: Lang[] = ["zh", "en"];

/** Shape of public/demos/manifest.json: when each demo's material is from and when it was generated. */
export interface DemoManifest {
  items: Record<string, { newsFrom: string | null; newsTo: string | null; generatedAt: string }>;
}

/** Earliest and latest YYYY-MM-DD dates that appear in a demo's input. */
export function newsDateRange(inputText: string): { newsFrom: string | null; newsTo: string | null } {
  const dates = [...inputText.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((m) => m[1]).sort();
  return { newsFrom: dates[0] ?? null, newsTo: dates.at(-1) ?? null };
}

export interface DemoHeadline {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: string | null;
  tickers: string[];
}

/** Shape of public/demos/<id>.<lang>.json. */
export interface DemoFile {
  id: string;
  kind: DemoKind;
  lang: Lang;
  generatedAt: string;
  provider: AnalyzeRequest["provider"];
  /** The text sent for analysis; for PDFs, a one-line description with the document date. */
  inputText: string;
  settings: AnalyzeRequest["settings"];
  /** Search demos: the headlines shown as selected. */
  headlines?: DemoHeadline[];
  /** PDF demos: questions answered ahead of time, in this file's language. */
  qa?: { question: string; answer: string }[];
  /** PDF demos: document metadata; the PDF is linked, not bundled. */
  pdf?: { fileName: string; sourceUrl: string; pageCount: number; retrieval: string; docTitle: string; docDate: string; publisher: string };
  // RunState, kept loose here to avoid a config → client import cycle.
  run: unknown;
}

/** How a search headline is turned into analysis input; shared by the UI and the demo builder. */
export const headlineLine = (n: { title: string; publisher: string; publishedAt: string | null }) =>
  `${n.title} (${n.publisher}, ${n.publishedAt?.slice(0, 10) ?? ""})`;
