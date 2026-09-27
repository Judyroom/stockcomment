"use client";

import { Loader2, Send } from "lucide-react";
import { useRef, useState } from "react";
import { embed, streamAsk } from "@/lib/client/api";
import type { DocIndex } from "@/lib/client/retriever";
import type { RunState } from "@/lib/client/run-state";
import { useI18n } from "@/lib/i18n";
import type { Kpi, Provider } from "@/lib/types";
import { CiteChip, Markdown } from "../Markdown";
import { Card, SectionHeading } from "../ui";
import { AgentCard } from "./Agents";

export function DocumentSection({
  run,
  onCite,
  index,
  fileName,
  provider,
}: {
  run: RunState;
  onCite: (id: string) => void;
  index: DocIndex | null;
  fileName: string | null;
  provider: Provider;
}) {
  const { t } = useI18n();
  const doc = run.agents.find((a) => a.info.role === "document");
  if (run.inputKind !== "pdf") return null;
  return (
    <div className="space-y-4">
      <SectionHeading>{t("document")}</SectionHeading>
      {run.kpis && run.kpis.length > 0 && <KpiTable kpis={run.kpis} onCite={onCite} />}
      {doc && <AgentCard agent={doc} onCite={onCite} />}
      {index && fileName && <AskDocument index={index} fileName={fileName} provider={provider} onCite={onCite} />}
    </div>
  );
}

function KpiTable({ kpis, onCite }: { kpis: Kpi[]; onCite: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <Card className="overflow-x-auto p-5">
      <div className="mb-3 text-sm font-semibold text-ink">{t("kpis")}</div>
      <table className="w-full min-w-[520px] text-left text-[13px]">
        <thead className="text-xs text-ink-3">
          <tr className="border-b border-border">
            <th className="py-1.5 pr-3 font-medium">{t("kpiMetric")}</th>
            <th className="py-1.5 pr-3 font-medium">{t("kpiValue")}</th>
            <th className="py-1.5 pr-3 font-medium">{t("kpiPeriod")}</th>
            <th className="py-1.5 pr-3 font-medium">{t("kpiChange")}</th>
            <th className="py-1.5 font-medium">{t("kpiSource")}</th>
          </tr>
        </thead>
        <tbody>
          {kpis.map((k, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="py-2 pr-3 text-ink">{k.metric}</td>
              <td className="tabular py-2 pr-3 font-medium text-ink">{k.value}</td>
              <td className="py-2 pr-3 text-ink-2">{k.period}</td>
              <td className="tabular py-2 pr-3 text-ink-2">{k.change ?? "—"}</td>
              <td className="py-2">
                <CiteChip id={k.evidence} onClick={() => onCite(k.evidence)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

interface Turn {
  role: "user" | "assistant";
  content: string;
}

function AskDocument({ index, fileName, provider, onCite }: { index: DocIndex; fileName: string; provider: Provider; onCite: (id: string) => void }) {
  const { t, lang } = useI18n();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (!question || busy) return;
    setQ("");
    setBusy(true);
    const history = turns.slice(-6);
    setTurns((ts) => [...ts, { role: "user", content: question }, { role: "assistant", content: "" }]);
    abort.current = new AbortController();
    try {
      const chunks = index.fitsFullText ? index.chunks : await index.search([question], 10, index.hasVectors ? embed : undefined);
      await streamAsk(
        { lang, provider, question, fileName, chunks, history },
        (text) => setTurns((ts) => ts.map((m, i) => (i === ts.length - 1 ? { ...m, content: m.content + text } : m))),
        abort.current.signal,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTurns((ts) => ts.map((m, i) => (i === ts.length - 1 ? { ...m, content: m.content + `\n\n_${msg}_` } : m)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 text-sm font-semibold text-ink">{t("ask")}</div>
      {turns.length > 0 && (
        <div className="mb-4 space-y-3">
          {turns.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto w-fit max-w-[85%] rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">
                {m.content}
              </div>
            ) : (
              <div key={i} className="max-w-[95%]">
                <Markdown text={m.content || "…"} streaming={busy && i === turns.length - 1} onCite={onCite} />
              </div>
            ),
          )}
        </div>
      )}
      <form onSubmit={ask} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("askPlaceholder")}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {t("askSend")}
        </button>
      </form>
    </Card>
  );
}
