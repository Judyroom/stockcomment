"use client";

import { FileText, Newspaper, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import type { RunState } from "@/lib/client/run-state";
import { useI18n } from "@/lib/i18n";
import { StanceBadge } from "./ui";

export function HistoryDrawer({
  open,
  items,
  onClose,
  onOpen,
  onDelete,
}: {
  open: boolean;
  items: RunState[];
  onClose: () => void;
  onOpen: (r: RunState) => void;
  onDelete: (id: string) => void;
}) {
  const { t, lang } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={t("history")}>
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label={t("close")} />
      <aside className="absolute top-0 right-0 flex h-full w-full max-w-sm flex-col border-l border-border bg-surface shadow-card">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <h2 className="font-serif text-lg font-semibold text-ink">{t("history")}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-3 hover:text-ink" aria-label={t("close")}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {items.length === 0 && <p className="p-3 text-sm text-ink-3">{t("noHistory")}</p>}
          <ul className="space-y-1.5">
            {items.map((r) => {
              const Icon = r.inputKind === "pdf" ? FileText : Newspaper;
              return (
                <li key={r.id} className="group flex items-start gap-2 rounded-lg border border-border p-2.5 hover:border-border-strong">
                  <button type="button" onClick={() => onOpen(r)} className="flex min-w-0 flex-1 gap-2 text-left">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-[13px] leading-snug text-ink">{r.title}</span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-ink-3">
                        {r.scorecard && <StanceBadge stance={r.scorecard.verdict.stance} label={t(r.scorecard.verdict.stance)} />}
                        <span className="tabular">{new Date(r.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "short", timeStyle: "short" })}</span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(r.id)}
                    className="rounded p-1 text-ink-3 opacity-0 group-hover:opacity-100 hover:text-bear focus:opacity-100"
                    aria-label={t("delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
