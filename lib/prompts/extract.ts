// Replaces v1's 400-term keyword lists and regexes with one structured extraction call.

import type { Lang } from "@/lib/types";

export const EXTRACT_SYSTEM = `You are a financial information extraction engine. Read the text and return structured data only.
- Identify listed companies and indices. Mark the ones the story is about as role "subject"; brokers issuing forecasts, data sources, and names mentioned in passing are "mentioned".
- Give each a Yahoo Finance symbol when you are confident: US tickers as-is (AAPL, BRK-B), Hong Kong as 4-digit code + .HK (0700.HK, 9988.HK), Shanghai .SS, Shenzhen .SZ, indices with ^ (^GSPC, ^HSI). Use null when unsure.
- keyFacts must be facts stated in the text, with their numbers, not your opinions.
- searchQueries are short English queries (2-5 words) to find related recent news.`;

// Entity names stay English because they are used to look up tickers and news.
const outputLanguage = (lang: Lang) =>
  `Write headline, summary, eventType and keyFacts in ${lang === "zh" ? "Simplified Chinese" : "English"}. Entity names and searchQueries stay in English.`;

export const extractPrompt = (text: string, kind: "text" | "pdf", lang: Lang, fileName?: string) =>
  kind === "pdf"
    ? `The following are the opening pages of the document "${fileName}". Extract what the document is about. ${outputLanguage(lang)}\n\n${text}`
    : `Extract the key information from this financial news text. ${outputLanguage(lang)}\n\n${text}`;
