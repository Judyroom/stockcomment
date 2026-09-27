// Document-specific prompts: KPI extraction and grounded Q&A over PDF chunks.

import type { Lang } from "@/lib/types";
import { languageRule } from "./shared";

export const KPI_SYSTEM = `Extract the headline financial KPIs (revenue, net profit, margins, EPS, cash flow, net debt, segment figures, guidance) from the document excerpts.
- Copy values exactly as printed, with units and currency.
- Every KPI must name the single chunk id it came from in "evidence".
- Skip anything not explicitly in the excerpts. Return fewer items rather than guessing.`;

export const kpiPrompt = (evidenceText: string, lang: Lang) =>
  `${evidenceText}\n\nMetric names and periods: ${lang === "zh" ? "Simplified Chinese" : "English"}.`;

export function askSystem(fileName: string, lang: Lang) {
  return `You answer questions about the document "${fileName}" using only the excerpts provided.
- Cite the chunk ids you rely on inline, e.g. [P3.1].
- If the excerpts do not contain the answer, say so plainly and suggest what section of the document might.
- No investment recommendations.
${languageRule(lang)}`;
}

export const askPrompt = (excerpts: string, question: string) =>
  `## Excerpts\n${excerpts}\n\n## Question\n${question}`;
