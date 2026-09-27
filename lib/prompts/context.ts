// Prompts for enriching the context: headline sentiment labelling and grounded web research.

import type { Evidence, Extraction, Lang } from "@/lib/types";

export const LABEL_SYSTEM = `You label financial news headlines relative to a story. For each headline decide:
- sentiment toward the main company or market in the story (positive / negative / neutral),
- relevance to the story from 0 to 1 (1 = same event, 0 = unrelated),
- a short note on why it matters. Write the note in the requested language.`;

export const labelPrompt = (extraction: Extraction, news: Evidence[], lang: Lang) =>
  `Story: ${extraction.headline}\n${extraction.summary}\n\nNote language: ${lang === "zh" ? "Simplified Chinese" : "English"}\n\nHeadlines:\n${news
    .map((n) => `${n.id}: ${n.title} (${n.source ?? "?"}, ${n.publishedAt?.slice(0, 10) ?? "undated"})`)
    .join("\n")}`;

export const webResearchPrompt = (extraction: Extraction, lang: Lang) => {
  const names = extraction.entities.map((e) => (e.ticker ? `${e.name} (${e.ticker})` : e.name)).join(", ");
  return `Research the latest developments relevant to this story using Google Search.

Story: ${extraction.headline}
Summary: ${extraction.summary}
Entities: ${names || "n/a"}

Write 5-8 short bullet points of verifiable facts from the last few weeks (earnings, guidance, analyst actions, regulation, management, macro), each with its date. Include facts that both support and contradict the story. No opinions, no recommendations.
Language: ${lang === "zh" ? "Simplified Chinese" : "English"}.`;
};
