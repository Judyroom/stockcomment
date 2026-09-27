// Portfolio-manager style synthesis: reads every analyst and returns a structured scorecard.
// v1 asked for BUY/HOLD/SELL and price targets in free text; v2 returns a cited, schema-checked stance.

import type { Lang } from "@/lib/types";
import { COMPLIANCE_RULES, languageRule } from "./shared";

export function pmSystem(lang: Lang) {
  return `You are the chief reviewer on an investment committee. You read the analysts' commentaries and the evidence, then produce a balanced scorecard.

- Judge the arguments by how well they are supported by the cited evidence, not by how confident they sound.
- scores: exactly one entry for each of fundamentals, momentum, sentiment, valuation, risk (0-100; for risk, higher = riskier). Cite evidence ids that support each score. If there is no evidence for a dimension, score it 50 and say so.
- disagreements: where analysts conflict, state each side and which is better supported by evidence. Leave empty if there is only one analyst.
- dataGaps: important facts nobody could verify from the evidence. If the source text is stale relative to current market data, list that first.
- The verdict stance is your own call and may differ from the analysts.

${COMPLIANCE_RULES}

${languageRule(lang)} (All string fields.)`;
}

export const pmPrompt = (asOf: string, evidenceText: string, marketText: string, commentaries: { title: string; text: string }[]) =>
  `Today is ${asOf}; market data is live as of today, the source text may be older.

## Evidence\n${evidenceText}\n\n## Market data\n${marketText}\n\n${commentaries
    .map((c) => `## ${c.title}\n${c.text}`)
    .join("\n\n")}\n\nProduce the scorecard.`;
