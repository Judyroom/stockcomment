"use client";

import { History, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Theme = "system" | "light" | "dark";

export function Header({ onHistory }: { onHistory: () => void }) {
  const { t, lang, setLang } = useI18n();
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const d = document.documentElement.dataset.theme;
    // Read what the pre-paint script applied.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d === "light" || d === "dark") setTheme(d);
  }, []);

  const cycle = () => {
    const next: Theme = theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
    setTheme(next);
    try {
      if (next === "system") {
        delete document.documentElement.dataset.theme;
        localStorage.removeItem("sc.theme");
      } else {
        document.documentElement.dataset.theme = next;
        localStorage.setItem("sc.theme", next);
      }
    } catch {}
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const btn = "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink";

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Mark />
          <div className="min-w-0">
            <div className="truncate font-serif text-[17px] leading-tight font-semibold tracking-tight text-ink">{t("appName")}</div>
            <div className="hidden truncate text-[11px] text-ink-3 sm:block">{t("appSub")}</div>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <button type="button" className={btn} onClick={onHistory}>
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">{t("history")}</span>
          </button>
          <button type="button" className={btn} onClick={() => setLang(lang === "zh" ? "en" : "zh")} aria-label="language">
            {t("langToggle")}
          </button>
          <button type="button" className={btn} onClick={cycle} aria-label={`${t("theme")}: ${theme}`} title={`${t("theme")}: ${theme}`}>
            <ThemeIcon className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </header>
  );
}

/** Two opposing candles: the bull/bear debate in one glyph. */
function Mark() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden>
      <rect width="28" height="28" rx="7" fill="var(--ink)" />
      <path d="M10 5v18" stroke="var(--bull)" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="7.5" y="9" width="5" height="9" rx="1" fill="var(--bull)" />
      <path d="M18 5v18" stroke="var(--bear)" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="15.5" y="11" width="5" height="8" rx="1" fill="var(--bear)" />
    </svg>
  );
}
