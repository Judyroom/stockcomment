"use client";

import { Check, Loader2, Minus, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Stance, StageStatus } from "@/lib/types";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx("rounded-xl border border-border bg-surface shadow-card", className)}>
      {children}
    </section>
  );
}

export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-serif text-lg font-semibold tracking-tight text-ink">{children}</h2>
      {aside && <div className="text-xs text-ink-3">{aside}</div>}
    </div>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5">
      <div className="text-[13px] font-medium text-ink-2">{children}</div>
      {hint && <div className="text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" className="flex w-full rounded-lg border border-border bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 rounded-md px-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
            size === "sm" ? "py-1 text-xs" : "py-1.5 text-[13px]",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cx("flex items-start justify-between gap-3", disabled ? "opacity-50" : "cursor-pointer")}>
      <span>
        <span className="block text-[13px] font-medium text-ink-2">{label}</span>
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-5 w-9 rounded-full bg-border-strong transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40" />
        <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

const STANCE_STYLE: Record<Stance, string> = {
  bullish: "bg-bull-soft text-bull",
  bearish: "bg-bear-soft text-bear",
  neutral: "bg-neutral-soft text-neutral",
};

export function StanceBadge({ stance, label, large }: { stance: Stance; label: string; large?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center rounded-full font-semibold whitespace-nowrap",
        large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]",
        STANCE_STYLE[stance],
      )}
    >
      {label}
    </span>
  );
}

export const stanceColor = (stance: Stance | null) =>
  stance === "bullish" ? "var(--bull)" : stance === "bearish" ? "var(--bear)" : stance === "neutral" ? "var(--neutral)" : "var(--accent)";

export function StatusIcon({ status }: { status: StageStatus | "streaming" | "idle" }) {
  if (status === "running" || status === "streaming") return <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" aria-hidden />;
  if (status === "done") return <Check className="h-3.5 w-3.5 text-bull" aria-hidden />;
  if (status === "error") return <X className="h-3.5 w-3.5 text-bear" aria-hidden />;
  return <Minus className="h-3.5 w-3.5 text-ink-3" aria-hidden />;
}

export function Chip({ children, active, onClick, disabled }: { children: ReactNode; active?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cx(
        "rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-ink-2 hover:border-border-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
