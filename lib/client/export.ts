// Render a finished run as a standalone Markdown report.

import type { Lang } from "@/lib/types";
import type { RunState } from "./run-state";

export function toMarkdown(run: RunState, lang: Lang): string {
  const zh = lang === "zh";
  const L = (en: string, cn: string) => (zh ? cn : en);
  const out: string[] = [];
  const x = run.extraction;

  out.push(`# ${x?.headline ?? run.title}`, "");
  out.push(`> ${L("Educational use only. Not investment advice.", "仅供学习研究，不构成投资建议。")}`, "");
  if (x) {
    out.push(x.summary, "");
    if (x.keyFacts.length) out.push(`## ${L("Key facts", "关键事实")}`, ...x.keyFacts.map((f) => `- ${f}`), "");
  }
  if (run.quotes.length) {
    out.push(`## ${L("Market snapshot", "行情快照")}`, "", "| Symbol | Price | Day | P/E |", "|---|---|---|---|");
    for (const q of run.quotes) out.push(`| ${q.symbol} | ${q.price ?? "—"} ${q.currency ?? ""} | ${q.changePct?.toFixed(2) ?? "—"}% | ${q.pe?.toFixed(1) ?? "—"} |`);
    out.push("");
  }
  if (run.kpis?.length) {
    out.push(`## ${L("Key figures", "关键数据")}`, "", "| Metric | Value | Period | Change | Source |", "|---|---|---|---|---|");
    for (const k of run.kpis) out.push(`| ${k.metric} | ${k.value} | ${k.period} | ${k.change ?? "—"} | ${k.evidence} |`);
    out.push("");
  }
  for (const a of run.agents) {
    if (!a.text) continue;
    out.push(`## ${a.info.title}`, "", a.text.trim(), "");
  }
  const c = run.scorecard;
  if (c) {
    out.push(`## ${L("Reviewer scorecard", "评审评分卡")}`, "", `**${c.verdict.stance.toUpperCase()}** · ${c.verdict.conviction}/5 — ${c.verdict.oneLiner}`, "");
    for (const s of c.scores) out.push(`- **${s.dimension}** ${Math.round(s.score)}: ${s.rationale} ${s.evidence.map((e) => `[${e}]`).join("")}`);
    out.push("");
    if (c.keyRisks.length) out.push(`**${L("Key risks", "主要风险")}**`, ...c.keyRisks.map((r) => `- ${r}`), "");
    if (c.dataGaps.length) out.push(`**${L("Data gaps", "信息缺口")}**`, ...c.dataGaps.map((r) => `- ${r}`), "");
  }
  if (run.evidence.length) {
    out.push(`## ${L("Evidence", "证据")}`, "");
    for (const e of run.evidence) {
      const title = e.url ? `[${e.title}](${e.url})` : e.title;
      out.push(`- **[${e.id}]** ${title}${e.source ? ` — ${e.source}` : ""}${e.publishedAt ? `, ${e.publishedAt.slice(0, 10)}` : ""}`);
    }
    out.push("");
  }
  if (run.meta) out.push(`---`, `${run.meta.provider} · ${Object.values(run.meta.models).join(", ")} · ${(run.meta.ms / 1000).toFixed(0)}s · ${new Date(run.createdAt).toISOString()}`);
  return out.join("\n");
}
