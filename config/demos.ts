// Built-in demo cases. Their inputs are real headlines pulled from Yahoo Finance when
// `npm run demos` is run, and their full results are stored in public/demos/<id>.<lang>.json,
// so opening a demo costs no tokens. Re-run `npm run demos` to refresh them.

import type { AnalyzeRequest } from "@/lib/schemas";
import type { Lang } from "@/lib/types";

export interface DemoSpec {
  id: string;
  label: Record<Lang, string>;
  /** Yahoo Finance news query used to collect the input headlines. */
  query: string;
  /** Only headlines matching this are used, so the input stays on topic. */
  mustInclude: RegExp;
  /** The symbol the story is about, used by the eval script. null for macro stories. */
  primaryTicker: string | null;
  settings: AnalyzeRequest["settings"];
}

export const DEMOS: DemoSpec[] = [
  {
    id: "tesla",
    label: { en: "Tesla deliveries", zh: "特斯拉交付" },
    query: "Tesla deliveries",
    mustInclude: /tesla/i,
    primaryTicker: "TSLA",
    settings: { mode: "debate", strength: "moderate", bullPersona: "growth_seeker", bearPersona: "value_investor", rebuttal: true },
  },
  {
    id: "nvidia",
    label: { en: "Nvidia · 3 analysts", zh: "英伟达 · 三位分析师" },
    query: "Nvidia stock",
    mustInclude: /nvidia/i,
    primaryTicker: "NVDA",
    settings: { mode: "single", stance: "neutral", strength: "moderate", personas: ["value_investor", "growth_seeker", "market_technician"] },
  },
  {
    id: "tencent",
    label: { en: "Tencent (HK)", zh: "腾讯（港股）" },
    query: "Tencent",
    mustInclude: /tencent/i,
    primaryTicker: "0700.HK",
    settings: { mode: "debate", strength: "moderate", bullPersona: "contrarian_thinker", bearPersona: "macro_visionary", rebuttal: true },
  },
  {
    id: "fed",
    label: { en: "Fed & rates", zh: "美联储与利率" },
    query: "Federal Reserve interest rates",
    mustInclude: /fed|federal reserve|rate|powell|inflation/i,
    primaryTicker: null,
    settings: { mode: "debate", strength: "moderate", bullPersona: "macro_visionary", bearPersona: "contrarian_thinker", rebuttal: true },
  },
];

export const DEMO_LANGS: Lang[] = ["zh", "en"];

/** Shape of public/demos/manifest.json: when each demo's news is from and when it was generated. */
export interface DemoManifest {
  items: Record<string, { newsFrom: string | null; newsTo: string | null; generatedAt: string }>;
}

/** Earliest and latest YYYY-MM-DD dates that appear in a demo's input headlines. */
export function newsDateRange(inputText: string): { newsFrom: string | null; newsTo: string | null } {
  const dates = [...inputText.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((m) => m[1]).sort();
  return { newsFrom: dates[0] ?? null, newsTo: dates.at(-1) ?? null };
}

/** Shape of public/demos/<id>.<lang>.json. */
export interface DemoFile {
  id: string;
  lang: Lang;
  generatedAt: string;
  provider: AnalyzeRequest["provider"];
  inputText: string;
  settings: AnalyzeRequest["settings"];
  // RunState, kept loose here to avoid a config → client import cycle.
  run: unknown;
}
