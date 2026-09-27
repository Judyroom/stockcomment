"use client";

import { FileText, Loader2, Newspaper, Search, Type, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DEMOS, type DemoManifest } from "@/config/demos";
import { ApiError, searchNews } from "@/lib/client/api";
import { formatRange, loadDemoManifest } from "@/lib/client/demos";
import type { PdfPhase } from "@/lib/client/use-pdf";
import type { ParsedPdf } from "@/lib/client/pdf";
import { useI18n, type TKey } from "@/lib/i18n";
import type { NewsItem } from "@/lib/tools/news";
import { Chip, cx } from "./ui";

export type InputTab = "text" | "search" | "pdf";

interface Props {
  tab: InputTab;
  setTab: (t: InputTab) => void;
  text: string;
  setText: (t: string) => void;
  selected: NewsItem[];
  setSelected: (items: NewsItem[]) => void;
  pdf: { phase: PdfPhase; doc: ParsedPdf | null; fitsFullText: boolean; load: (f: File) => void; clear: () => void };
  disabled: boolean;
  activeDemo: string | null;
  onDemo: (id: string) => void;
}

export function InputPanel({ tab, setTab, text, setText, selected, setSelected, pdf, disabled, activeDemo, onDemo }: Props) {
  const { t, lang } = useI18n();
  const [manifest, setManifest] = useState<DemoManifest | null>(null);
  useEffect(() => {
    loadDemoManifest().then(setManifest);
  }, []);
  const tabs: { id: InputTab; label: string; icon: typeof Type }[] = [
    { id: "text", label: t("tabText"), icon: Type },
    { id: "search", label: t("tabSearch"), icon: Search },
    { id: "pdf", label: t("tabPdf"), icon: FileText },
  ];

  return (
    <div>
      <div role="tablist" className="mb-3 flex gap-1 border-b border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cx(
              "-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[13px] font-medium transition-colors",
              tab === id ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink-2",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === "text" && (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
            rows={7}
            placeholder={t("textPlaceholder")}
            className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          <div className="mt-2 text-xs text-ink-3">{t("demos")}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DEMOS.map((d) => {
              const m = manifest?.items[d.id];
              const dates = m
                ? t("demoDates", { news: formatRange(m.newsFrom, m.newsTo), date: localDate(m.generatedAt) })
                : undefined;
              return (
                <Chip key={d.id} active={activeDemo === d.id} onClick={() => onDemo(d.id)} disabled={disabled}>
                  <span title={dates}>{d.label[lang]}</span>
                </Chip>
              );
            })}
          </div>
          {manifest && Object.keys(manifest.items).length > 0 && (
            <p className="mt-1.5 text-[11px] text-ink-3 tabular">
              {t("demoDates", {
                news: formatRange(
                  Object.values(manifest.items).map((m) => m.newsFrom).filter(Boolean).sort()[0],
                  Object.values(manifest.items).map((m) => m.newsTo).filter(Boolean).sort().at(-1),
                ),
                date: localDate(Object.values(manifest.items).map((m) => m.generatedAt).sort().at(-1)!),
              })}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-ink-3">{t("demosHint")}</p>
        </div>
      )}

      {tab === "search" && <SearchTab selected={selected} setSelected={setSelected} disabled={disabled} />}

      {tab === "pdf" && <PdfTab pdf={pdf} disabled={disabled} />}
    </div>
  );
}

function SearchTab({ selected, setSelected, disabled }: Pick<Props, "selected" | "setSelected" | "disabled">) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await searchNews(query.trim()));
    } catch (err) {
      const key = err instanceof ApiError ? (`err_${err.code}` as TKey) : null;
      setError(key && t(key) !== key ? t(key) : err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const toggle = (n: NewsItem) =>
    setSelected(selected.some((s) => s.uuid === n.uuid) ? selected.filter((s) => s.uuid !== n.uuid) : [...selected, n].slice(0, 5));

  return (
    <div>
      <form onSubmit={run} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={disabled || loading}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-[13px] font-medium text-ink hover:border-border-strong disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {t("search")}
        </button>
      </form>
      <p className="mt-2 text-xs text-ink-3">
        {t("searchHint")} {selected.length > 0 && <span className="text-accent">{t("selected")} {selected.length}</span>}
      </p>
      {error && <p className="mt-2 text-xs text-bear">{error}</p>}
      {items && items.length === 0 && <p className="mt-3 text-sm text-ink-3">{t("noResults")}</p>}
      {items && items.length > 0 && (
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
          {items.map((n) => {
            const on = selected.some((s) => s.uuid === n.uuid);
            return (
              <li key={n.uuid}>
                <button
                  type="button"
                  onClick={() => toggle(n)}
                  disabled={disabled}
                  className={cx(
                    "flex w-full gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    on ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-2",
                  )}
                >
                  <Newspaper className={cx("mt-0.5 h-3.5 w-3.5 shrink-0", on ? "text-accent" : "text-ink-3")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[13px] leading-snug text-ink">{n.title}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-3">
                      {n.publisher} · {n.publishedAt?.slice(0, 10)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PdfTab({ pdf, disabled }: { pdf: Props["pdf"]; disabled: boolean }) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const { phase, doc } = pdf;

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))) pdf.load(f);
  };

  if (doc && phase.kind === "ready") {
    const emb = phase.embedding;
    return (
      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{doc.fileName}</div>
            <div className="text-xs text-ink-3 tabular">
              {t("pdfPages", { n: doc.pageCount, c: doc.chunks.length, k: (doc.totalChars / 1000).toFixed(1) })}
            </div>
          </div>
          <button type="button" onClick={pdf.clear} disabled={disabled} className="text-ink-3 hover:text-ink" aria-label={t("pdfRemove")}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-2">{pdf.fitsFullText ? t("pdfFull") : t("pdfRag")}</p>
        {!pdf.fitsFullText && (
          <p className="mt-1 text-xs text-ink-3">
            {emb === "ready"
              ? t("pdfEmbedded")
              : emb === "off" || emb === "error"
                ? t("pdfNoEmbed")
                : t("pdfEmbedding", { d: emb.done, n: emb.total })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled || phase.kind === "parsing"}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cx(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
          drag ? "border-accent bg-accent-soft" : "border-border-strong bg-surface hover:bg-surface-2",
        )}
      >
        {phase.kind === "parsing" ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <span className="text-sm text-ink-2">{t("pdfParsing", { p: phase.page, n: phase.total || "?" })}</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-ink-3" />
            <span className="text-sm text-ink-2">{t("pdfDrop")}</span>
          </>
        )}
      </button>
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <p className="mt-2 text-xs text-ink-3">{t("pdfHint")}</p>
      {phase.kind === "error" && <p className="mt-2 text-xs text-bear">{phase.message}</p>}
    </div>
  );
}

/** YYYY-MM-DD in the viewer's time zone. */
const localDate = (iso: string) => new Date(iso).toLocaleDateString("sv-SE");
