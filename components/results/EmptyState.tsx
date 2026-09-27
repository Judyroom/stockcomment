"use client";

import { useI18n, type TKey } from "@/lib/i18n";

const STEPS: [TKey, TKey][] = [
  ["step1", "step1d"],
  ["step2", "step2d"],
  ["step3", "step3d"],
  ["step4", "step4d"],
];

export function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col justify-center py-10 lg:py-20">
      <h1 className="max-w-xl font-serif text-3xl leading-tight font-semibold tracking-tight text-ink text-balance sm:text-4xl">{t("emptyTitle")}</h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">{t("emptyBody")}</p>
      <ol className="mt-10 grid max-w-3xl gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        {STEPS.map(([title, desc], i) => (
          <li key={title} className="bg-surface p-4">
            <div className="font-mono text-[11px] text-ink-3">0{i + 1}</div>
            <div className="mt-1 text-sm font-semibold text-ink">{t(title)}</div>
            <div className="mt-1 text-xs leading-relaxed text-ink-3">{t(desc)}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
