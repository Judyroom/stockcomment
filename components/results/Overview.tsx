"use client";

import { ExternalLink } from "lucide-react";
import type { RunState } from "@/lib/client/run-state";
import { useI18n, type TKey } from "@/lib/i18n";
import type { Evidence, Quote, StageId } from "@/lib/types";
import { Card, SectionHeading, StatusIcon, cx } from "../ui";

const ORDER: StageId[] = ["extract", "market", "news", "web", "context", "analysts", "rebuttal", "kpis", "pm"];

export function Pipeline({ run }: { run: RunState }) {
  const { t } = useI18n();
  const stages = ORDER.filter((id) => run.stages[id] && run.stages[id]!.status !== "skipped");
  const failed = stages.filter((id) => run.stages[id]!.status === "error");
  return (
    <div className="min-w-0 flex-1">
    <ol className="flex flex-wrap gap-1.5" aria-label="pipeline">
      {stages.map((id) => {
        const st = run.stages[id]!;
        return (
          <li
            key={id}
            title={st.detail}
            className={cx(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              st.status === "running" ? "border-accent/40 bg-accent-soft text-ink" : "border-border bg-surface text-ink-2",
              st.status === "error" && "border-bear/40 text-bear",
            )}
          >
            <StatusIcon status={st.status} />
            {t(`stage_${id}` as TKey)}
            {st.status === "done" && st.detail && id !== "analysts" && <span className="tabular text-ink-3">· {st.detail}</span>}
          </li>
        );
      })}
    </ol>
    {failed.length > 0 && (
      <ul className="mt-2 space-y-0.5 text-xs text-bear">
        {failed.map((id) => (
          <li key={id}>
            {t(`stage_${id}` as TKey)}：{stageError(run.stages[id]!.detail, t)}
          </li>
        ))}
      </ul>
    )}
    </div>
  );
}

/** Short, human wording for the errors providers most often return. */
function stageError(detail: string | undefined, t: (k: TKey) => string) {
  if (!detail) return "";
  if (/quota|rate.?limit|resource.?exhausted|429/i.test(detail)) return t("err_quota");
  if (/high demand|overloaded|unavailable|503/i.test(detail)) return t("err_overloaded");
  if (/location is not supported/i.test(detail)) return t("err_location");
  return detail.slice(0, 200);
}

export function StoryCard({ run }: { run: RunState }) {
  const { t } = useI18n();
  const x = run.extraction;
  if (!x) return null;
  return (
    <Card className="p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-3">
        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium uppercase tracking-wide text-ink-2">{x.eventType}</span>
        <span>{t("story")}</span>
      </div>
      <h1 className="font-serif text-2xl leading-tight font-semibold tracking-tight text-ink text-balance">{x.headline}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{x.summary}</p>
      {x.entities.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {x.entities.map((e) => (
            <span key={e.name} className="rounded-md border border-border px-2 py-0.5 text-xs text-ink-2">
              {e.name}
              {e.ticker && <span className="ml-1 font-mono text-[11px] text-accent">{e.ticker}</span>}
            </span>
          ))}
        </div>
      )}
      {x.keyFacts.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-1.5 text-xs font-medium text-ink-3">{t("keyFacts")}</div>
          <ul className="grid gap-x-6 gap-y-1 text-[13px] text-ink-2 sm:grid-cols-2">
            {x.keyFacts.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-3" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function QuoteCards({ quotes, pending }: { quotes: Quote[]; pending: boolean }) {
  const { t } = useI18n();
  if (!quotes.length) {
    return pending ? null : <p className="text-sm text-ink-3">{t("noQuotes")}</p>;
  }
  return (
    <div id="market" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {quotes.map((q) => {
        const up = (q.changePct ?? 0) >= 0;
        return (
          <Card key={q.symbol} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-sm font-semibold text-ink">{q.symbol}</div>
                <div className="truncate text-xs text-ink-3">{q.name}</div>
              </div>
              <div className="text-right">
                <div className="tabular text-lg font-semibold text-ink">
                  {q.price?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? "—"}
                  <span className="ml-1 text-[11px] font-normal text-ink-3">{q.currency}</span>
                </div>
                {q.changePct != null && (
                  <div className={cx("tabular text-xs font-medium", up ? "text-bull" : "text-bear")}>
                    {up ? "+" : ""}
                    {q.changePct.toFixed(2)}%
                  </div>
                )}
              </div>
            </div>
            <Sparkline points={q.history.map((p) => p.c)} />
            <dl className="grid grid-cols-3 gap-2 text-[11px]">
              <Stat label={t("pe")} value={q.pe?.toFixed(1)} />
              <Stat label={t("mcap")} value={q.marketCap ? compact(q.marketCap) : undefined} />
              <Stat label={t("range52")} value={q.low52 != null && q.high52 != null ? `${round(q.low52)}–${round(q.high52)}` : undefined} />
            </dl>
          </Card>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-ink-3">{label}</dt>
      <dd className="tabular font-medium text-ink-2">{value ?? "—"}</dd>
    </div>
  );
}

/** 90-day close line, coloured by the period's direction. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="my-3 h-12" />;
  const w = 240;
  const h = 48;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - 3 - ((p - min) / span) * (h - 6)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const up = points.at(-1)! >= points[0];
  const color = up ? "var(--bull)" : "var(--bear)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="my-3 h-12 w-full" preserveAspectRatio="none" role="img" aria-label="90 day price">
      <path d={`${line}L${w},${h}L0,${h}Z`} fill={color} opacity={0.08} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function EvidenceList({ evidence, open, onToggle }: { evidence: Evidence[]; open: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  if (!evidence.length) return null;
  return (
    <Card id="evidence" className="p-5">
      <button type="button" onClick={onToggle} className="w-full text-left" aria-expanded={open}>
        <SectionHeading aside={open ? t("evidenceHint") : `${evidence.length}`}>{t("evidence")}</SectionHeading>
      </button>
      {open && (
        <ul className="space-y-2">
          {evidence.map((e) => (
            <li
              key={e.id}
              id={`ev-${e.id}`}
              className={cx("flex gap-3 rounded-lg border border-border p-2.5", (e.relevance ?? 1) < 0.25 && "opacity-55")}
            >
              <span className="mt-0.5 h-fit shrink-0 rounded bg-surface-2 px-1.5 font-mono text-[11px] font-semibold text-ink-2">{e.id}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <span className="text-[13px] leading-snug text-ink">{e.title}</span>
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 shrink-0 text-ink-3 hover:text-accent" aria-label="open">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-3">
                  {e.source && <span>{e.source}</span>}
                  {e.publishedAt && <span className="tabular">{e.publishedAt.slice(0, 10)}</span>}
                  {e.sentiment && <SentimentDot s={e.sentiment} />}
                  {(e.relevance ?? 1) < 0.25 && <span>{t("lowRelevance")}</span>}
                </div>
                {e.note && <p className="mt-1 text-xs text-ink-2">{e.note}</p>}
                {e.text && (
                  <p className="mt-1 line-clamp-4 text-xs leading-relaxed whitespace-pre-line text-ink-3">{e.text}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SentimentDot({ s }: { s: NonNullable<Evidence["sentiment"]> }) {
  const color = s === "positive" ? "bg-bull" : s === "negative" ? "bg-bear" : "bg-neutral";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cx("h-1.5 w-1.5 rounded-full", color)} />
      {s}
    </span>
  );
}

const round = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));
const compact = (n: number) =>
  n >= 1e12 ? `${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : `${(n / 1e6).toFixed(0)}M`;
