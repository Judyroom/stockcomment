"use client";

import { Loader2 } from "lucide-react";
import { useI18n, type TKey } from "@/lib/i18n";
import type { Scorecard } from "@/lib/types";
import { CiteChip } from "../Markdown";
import { Card, SectionHeading, StanceBadge, cx } from "../ui";

export function ScorecardView({ card, pending, onCite }: { card?: Scorecard; pending: boolean; onCite: (id: string) => void }) {
  const { t } = useI18n();
  if (!card) {
    return pending ? (
      <Card className="flex items-center gap-2 p-5 text-sm text-ink-3">
        <Loader2 className="h-4 w-4 animate-spin text-accent" /> {t("scorecard")}…
      </Card>
    ) : null;
  }
  const { verdict } = card;

  return (
    <Card id="scorecard" className="p-5 sm:p-6">
      <SectionHeading>{t("scorecard")}</SectionHeading>

      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <StanceBadge stance={verdict.stance} label={t(verdict.stance)} large />
          <div className="flex items-center gap-1" aria-label={`${t("conviction")} ${verdict.conviction}/5`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={cx("h-2 w-4 rounded-sm", i <= verdict.conviction ? "bg-ink" : "bg-border")} />
            ))}
          </div>
        </div>
        <p className="font-serif text-lg leading-snug text-ink">{verdict.oneLiner}</p>
      </div>

      <div className="grid gap-x-8 gap-y-4 py-5 md:grid-cols-2">
        {card.scores.map((s) => {
          const risk = s.dimension === "risk";
          return (
            <div key={s.dimension}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-medium text-ink">{t(`dim_${s.dimension}` as TKey)}</span>
                <span className="tabular font-semibold text-ink">{Math.round(s.score)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cx("h-full rounded-full", risk ? "bg-warn" : "bg-accent")}
                  style={{ width: `${Math.max(2, Math.min(100, s.score))}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
                {s.rationale}
                {s.evidence.map((id) => (
                  <CiteChip key={id} id={id} onClick={() => onCite(id)} />
                ))}
              </p>
            </div>
          );
        })}
      </div>

      {(card.agreements.length > 0 || card.disagreements.length > 0) && (
        <div className="grid gap-5 border-t border-border py-5 lg:grid-cols-[1fr_2fr]">
          {card.agreements.length > 0 && (
            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-ink">{t("agreements")}</h3>
              <List items={card.agreements} />
            </div>
          )}
          {card.disagreements.length > 0 && (
            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-ink">{t("disagreements")}</h3>
              <div className="space-y-3">
                {card.disagreements.map((d, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-ink">{d.topic}</span>
                      <span className="shrink-0 text-[11px] text-ink-3">
                        {t("betterSupported")}:{" "}
                        <span
                          className={cx(
                            "font-semibold",
                            d.betterSupported === "bull" ? "text-bull" : d.betterSupported === "bear" ? "text-bear" : "text-ink-2",
                          )}
                        >
                          {t(d.betterSupported === "even" ? "even" : d.betterSupported)}
                        </span>
                      </span>
                    </div>
                    <div className="grid gap-2 text-xs leading-relaxed sm:grid-cols-2">
                      <p className="border-l-2 border-bull pl-2 text-ink-2">{d.bullView}</p>
                      <p className="border-l-2 border-bear pl-2 text-ink-2">{d.bearView}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 border-t border-border pt-5 md:grid-cols-3">
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-ink">{t("keyRisks")}</h3>
          <List items={card.keyRisks} />
        </div>
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-ink">{t("catalysts")}</h3>
          <List items={card.catalysts.map((c) => (c.timing ? `${c.event} (${c.timing})` : c.event))} />
        </div>
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-ink">{t("dataGaps")}</h3>
          <List items={card.dataGaps} muted />
        </div>
      </div>
    </Card>
  );
}

function List({ items, muted }: { items: string[]; muted?: boolean }) {
  if (!items.length) return <p className="text-xs text-ink-3">—</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((x, i) => (
        <li key={i} className={cx("flex gap-2 text-[13px] leading-relaxed", muted ? "text-ink-3" : "text-ink-2")}>
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-3" />
          {x}
        </li>
      ))}
    </ul>
  );
}
