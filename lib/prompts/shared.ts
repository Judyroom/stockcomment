// Building blocks shared by every prompt. Bump PROMPT_VERSION when behaviour changes
// so eval results can be tied to the prompt set that produced them.

import type { Evidence, Lang, Stance, Strength } from "@/lib/types";

export const PROMPT_VERSION = "2.0.0";

export const languageRule = (lang: Lang) =>
  lang === "zh"
    ? "Write the entire answer in Simplified Chinese. Keep tickers, company names and numbers in their original form."
    : "Write the entire answer in English.";

/**
 * The v1 prompts told the model to "construct unverifiable but plausible justifications".
 * v2 keeps the strong stance but makes every factual claim traceable.
 */
export const GROUNDING_RULES = `Evidence rules:
- Every factual claim (numbers, dates, events, quotes) must be supported by the evidence below and cited inline with its id in square brackets, e.g. [S1], [N3], [P12.1], [W2]. Multiple ids: [N1, N4].
- Never invent figures, events, price targets or quotes. If the evidence does not cover something important, say it is unknown.
- Reasoning that goes beyond the evidence is allowed but must be labelled as inference ("Inference:" / "推断：").
- Treat the source text [S1] as the claim under analysis, not as established truth; note where related coverage agrees or conflicts.
- The source text may be older than the market data. If its figures (prices, year-to-date moves, upcoming events) no longer match current market data [M], say so explicitly and reason from the current data instead of blending the two.`;

export const COMPLIANCE_RULES = `Scope rules:
- This is educational market commentary, not personalised investment advice. Do not tell the reader to buy, sell or size positions, and do not give price targets.
- Express conclusions as a stance (bullish / bearish / neutral) with conviction and the conditions that would change it.`;

export const STANCE_TEXT: Record<Stance, string> = {
  bullish: "bullish (constructive)",
  bearish: "bearish (skeptical)",
  neutral: "neutral (balanced)",
};

export const STRENGTH_TEXT: Record<Strength, string> = {
  strong: "high conviction",
  moderate: "moderate conviction",
  mild: "tentative, low conviction",
};

/** Render evidence as a compact, id-tagged list the model can cite. */
export function formatEvidence(evidence: Evidence[]): string {
  const groups: Record<string, Evidence[]> = {};
  for (const e of evidence) (groups[e.kind] ??= []).push(e);

  const header: Record<string, string> = {
    input: "SOURCE TEXT",
    pdf: "DOCUMENT EXCERPTS",
    news: "RELATED NEWS HEADLINES",
    web: "WEB RESEARCH SOURCES",
  };

  return (["input", "pdf", "news", "web"] as const)
    .filter((k) => groups[k]?.length)
    .map((k) => {
      const lines = groups[k].map((e) => {
        const meta = [e.source, e.publishedAt?.slice(0, 10), e.page ? `page ${e.page}` : null, e.sentiment]
          .filter(Boolean)
          .join(" | ");
        const body = e.text ? `\n${e.text}` : "";
        const note = e.note ? ` (${e.note})` : "";
        return `[${e.id}] ${e.title}${meta ? ` (${meta})` : ""}${note}${body}`;
      });
      return `### ${header[k]}\n${lines.join("\n\n")}`;
    })
    .join("\n\n");
}
