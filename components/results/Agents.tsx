"use client";

import { Brain, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { AgentState, RunState } from "@/lib/client/run-state";
import { useI18n } from "@/lib/i18n";
import { Markdown } from "../Markdown";
import { Card, SectionHeading, StanceBadge, StatusIcon, cx, stanceColor } from "../ui";

export function AgentsSection({ run, onCite }: { run: RunState; onCite: (id: string) => void }) {
  const { t } = useI18n();
  const analysts = run.agents.filter((a) => a.info.role === "analyst");
  const rebuttals = run.agents.filter((a) => a.info.role === "rebuttal");
  if (!analysts.length) return null;

  if (run.mode === "debate") {
    const byId = (id: string) => run.agents.find((a) => a.info.id === id);
    return (
      <div>
        <SectionHeading>{t("debate")}</SectionHeading>
        <div className="mb-2 text-xs font-medium tracking-wide text-ink-3 uppercase">{t("openings")}</div>
        <div className="grid gap-4 lg:grid-cols-2">
          {["bull", "bear"].map((id) => {
            const a = byId(id);
            return a ? <AgentCard key={id} agent={a} onCite={onCite} /> : null;
          })}
        </div>
        {rebuttals.length > 0 && (
          <>
            <div className="mt-5 mb-2 text-xs font-medium tracking-wide text-ink-3 uppercase">{t("rebuttals")}</div>
            <div className="grid gap-4 lg:grid-cols-2">
              {["bull-rebuttal", "bear-rebuttal"].map((id) => {
                const a = byId(id);
                return a ? <AgentCard key={id} agent={a} onCite={onCite} compact /> : null;
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <SectionHeading>{t("analysts")}</SectionHeading>
      <div className={cx("grid gap-4", analysts.length > 1 && "lg:grid-cols-2", analysts.length > 2 && "2xl:grid-cols-3")}>
        {analysts.map((a) => (
          <AgentCard key={a.info.id} agent={a} onCite={onCite} />
        ))}
      </div>
    </div>
  );
}

export function AgentCard({ agent, onCite, compact }: { agent: AgentState; onCite: (id: string) => void; compact?: boolean }) {
  const { t } = useI18n();
  const { info, text, reasoning, status } = agent;
  const streaming = status === "streaming";
  const [showThinking, setShowThinking] = useState(false);
  const thinkingLive = streaming && reasoning && !text;

  return (
    <Card className="overflow-hidden">
      <div className="h-1" style={{ background: stanceColor(info.stance) }} />
      <div className={cx("p-5", compact && "p-4")}>
        <header className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {info.stance && <StanceBadge stance={info.stance} label={t(info.stance)} />}
            <h3 className="truncate text-sm font-semibold text-ink">{info.title}</h3>
          </div>
          <StatusIcon status={status === "error" ? "error" : streaming ? "streaming" : "done"} />
        </header>

        {reasoning && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowThinking((v) => !v)}
              className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink-2"
              aria-expanded={showThinking || Boolean(thinkingLive)}
            >
              <ChevronRight className={cx("h-3.5 w-3.5 transition-transform", (showThinking || thinkingLive) && "rotate-90")} />
              <Brain className="h-3.5 w-3.5" />
              {t("thinking")}
              <span className="tabular">· {reasoning.length.toLocaleString()}</span>
            </button>
            {(showThinking || thinkingLive) && (
              <pre className="mt-2 max-h-56 overflow-y-auto rounded-lg bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-ink-3">
                {reasoning}
              </pre>
            )}
          </div>
        )}

        {text ? (
          <Markdown text={text} streaming={streaming} onCite={onCite} />
        ) : (
          <p className="text-sm text-ink-3">{status === "error" ? t("agentError") : thinkingLive ? t("thinking") + "…" : t("writing")}</p>
        )}
        {agent.error && <p className="mt-3 rounded-md bg-bear-soft px-2 py-1 text-xs text-bear">{agent.error}</p>}
      </div>
    </Card>
  );
}
