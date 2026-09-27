"use client";

import { Copy, Download, Loader2, Play, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import { InputPanel, type InputTab } from "@/components/InputPanel";
import { AgentsSection } from "@/components/results/Agents";
import { DocumentSection } from "@/components/results/Document";
import { EmptyState } from "@/components/results/EmptyState";
import { EvidenceList, Pipeline, QuoteCards, StoryCard } from "@/components/results/Overview";
import { ScorecardView } from "@/components/results/Scorecard";
import { DEFAULT_SETTINGS, SettingsPanel, type Settings } from "@/components/SettingsPanel";
import { Card, SectionHeading } from "@/components/ui";
import { ApiError, accessCode, embed, fetchCapabilities, streamAnalyze } from "@/lib/client/api";
import { formatRange, loadDemo } from "@/lib/client/demos";
import { toMarkdown } from "@/lib/client/export";
import { deleteRun, loadHistory, saveRun } from "@/lib/client/history";
import { selectForAnalysis } from "@/lib/client/retriever";
import { newRun, reduce, type RunState } from "@/lib/client/run-state";
import { usePdf } from "@/lib/client/use-pdf";
import { useI18n, type TKey } from "@/lib/i18n";
import type { AnalyzeRequest } from "@/lib/schemas";
import type { NewsItem } from "@/lib/tools/news";
import type { ServerCapabilities } from "@/lib/types";

export default function Workbench() {
  const { t, lang } = useI18n();
  const [caps, setCaps] = useState<ServerCapabilities | null>(null);
  const [code, setCode] = useState("");

  const [tab, setTab] = useState<InputTab>("text");
  const [text, setText] = useState("");
  const [demo, setDemo] = useState<{ id: string; inputText: string } | null>(null);
  const [selected, setSelected] = useState<NewsItem[]>([]);
  const pdf = usePdf(Boolean(caps?.embeddings));
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [outputLang, setOutputLang] = useState<"en" | "zh" | null>(null);

  const [run, setRun] = useState<RunState | null>(null);
  const runRef = useRef<RunState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<RunState[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchCapabilities()
      .then((c) => {
        setCaps(c);
        setCode(accessCode.get());
        if (!c.providers.deepseek && c.providers.gemini) setSettings((s) => ({ ...s, provider: "gemini" }));
      })
      .catch(() => setCaps(null));
  }, []);

  const running = run?.status === "running";
  // A demo stays a demo until its text is edited; only custom input calls the API.
  const demoActive = tab === "text" && demo !== null && text === demo.inputText;

  async function openDemo(id: string) {
    setError(null);
    try {
      const d = await loadDemo(id, lang);
      const s = d.settings;
      setText(d.inputText);
      setDemo({ id, inputText: d.inputText });
      setSettings((prev) => ({
        ...prev,
        ...(s.mode === "single"
          ? { mode: "single" as const, stance: s.stance, strength: s.strength, personas: s.personas }
          : { mode: "debate" as const, strength: s.strength, bullPersona: s.bullPersona, bearPersona: s.bearPersona, rebuttal: s.rebuttal }),
        deep: false,
        web: false,
      }));
      runRef.current = d.run;
      setRun(d.run);
      setEvidenceOpen(false);
      if (window.matchMedia("(max-width: 1023px)").matches) {
        setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // Follow the UI language while a demo is on screen.
  useEffect(() => {
    if (!run?.demo || run.demo.lang === lang) return;
    loadDemo(run.demo.id, lang)
      .then((d) => {
        runRef.current = d.run;
        setRun(d.run);
      })
      .catch(() => {});
  }, [lang, run?.demo]);
  const index = pdf.index;
  const pdfBusy = pdf.phase.kind === "parsing" || (pdf.phase.kind === "ready" && typeof pdf.phase.embedding === "object");
  const canRun =
    !running &&
    Boolean(caps?.providers[settings.provider]) &&
    (tab === "text" ? text.trim().length >= 10 : tab === "search" ? selected.length > 0 : Boolean(pdf.doc) && !pdfBusy);

  const errorMessage = (err: unknown) => {
    if (err instanceof ApiError) {
      const key = `err_${err.code}` as TKey;
      return t(key) !== key ? t(key) : err.message;
    }
    return err instanceof Error ? err.message : String(err);
  };

  async function start() {
    setError(null);
    accessCode.set(code.trim());
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      let input: AnalyzeRequest["input"];
      if (tab === "pdf" && pdf.doc && index) {
        const { chunks, retrieval } = await selectForAnalysis(index, index.hasVectors ? embed : undefined);
        input = { kind: "pdf", fileName: pdf.doc.fileName, pageCount: pdf.doc.pageCount, retrieval, chunks };
      } else if (tab === "search") {
        input = { kind: "text", text: selected.map((n) => `${n.title} (${n.publisher}, ${n.publishedAt?.slice(0, 10) ?? ""})`).join("\n") };
      } else {
        input = { kind: "text", text: text.trim() };
      }

      const s = settings;
      const req: AnalyzeRequest = {
        lang: outputLang ?? lang,
        provider: s.provider,
        deepReasoning: s.deep,
        temperature: s.temperature,
        useWebSearch: s.web && Boolean(caps?.webSearch),
        settings:
          s.mode === "single"
            ? { mode: "single", stance: s.stance, strength: s.strength, personas: s.personas }
            : { mode: "debate", strength: s.strength, bullPersona: s.bullPersona, bearPersona: s.bearPersona, rebuttal: s.rebuttal },
        input,
      };

      const title = input.kind === "pdf" ? input.fileName : input.text.slice(0, 80);
      runRef.current = newRun(title, input.kind, s.mode);
      setRun(runRef.current);
      setEvidenceOpen(false);
      // On narrow screens the results sit below the form; bring them into view.
      if (window.matchMedia("(max-width: 1023px)").matches) {
        setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }), 50);
      }

      await streamAnalyze(
        req,
        (e) => {
          runRef.current = reduce(runRef.current!, e);
          setRun(runRef.current);
        },
        ctrl.signal,
      );
    } catch (err) {
      const aborted = ctrl.signal.aborted;
      const message = aborted ? t("stop") : errorMessage(err);
      if (runRef.current) {
        runRef.current = { ...runRef.current, status: "error", error: message };
        setRun(runRef.current);
      } else {
        setError(message);
      }
    } finally {
      const final = runRef.current;
      if (final) {
        if (final.status === "running") {
          runRef.current = { ...final, status: "done" };
          setRun(runRef.current);
        }
        if (!runRef.current!.demo && runRef.current!.agents.some((a) => a.text)) saveRun(runRef.current!);
      }
      abortRef.current = null;
    }
  }

  const onCite = useCallback((id: string) => {
    const target = id === "M" ? "market" : `ev-${id}`;
    if (id !== "M") setEvidenceOpen(true);
    setTimeout(() => {
      const el = document.getElementById(target);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }, 60);
  }, []);

  function download() {
    if (!run) return;
    const blob = new Blob([toMarkdown(run, outputLang ?? lang)], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `commentary-${new Date(run.createdAt).toISOString().slice(0, 10)}-${run.id}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copy() {
    if (!run) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(run, outputLang ?? lang));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  const hasPending = (id: keyof RunState["stages"]) => run?.stages[id]?.status === "running";

  return (
    <div className="min-h-screen">
      <Header
        onHistory={() => {
          setHistory(loadHistory());
          setHistoryOpen(true);
        }}
      />
      <div className="border-b border-border bg-warn-soft">
        <p className="mx-auto max-w-[1440px] px-4 py-1.5 text-[12px] leading-snug text-warn sm:px-6">{t("disclaimer")}</p>
      </div>

      <main className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pb-2">
          <Card className="p-4">
            <InputPanel
              tab={tab}
              setTab={setTab}
              text={text}
              setText={setText}
              selected={selected}
              setSelected={setSelected}
              pdf={{ phase: pdf.phase, doc: pdf.doc, fitsFullText: index?.fitsFullText ?? true, load: pdf.load, clear: pdf.clear }}
              disabled={running}
              activeDemo={demoActive ? demo!.id : null}
              onDemo={openDemo}
            />
          </Card>
          <Card className="p-4">
            <div className="mb-3 text-sm font-semibold text-ink">{t("settingsTitle")}</div>
            <SettingsPanel
              value={{ ...settings, outputLang: outputLang ?? lang }}
              onChange={(patch) => {
                if (patch.outputLang) setOutputLang(patch.outputLang);
                setSettings((s) => ({ ...s, ...patch }));
              }}
              caps={caps}
              disabled={running}
            />
            {caps?.accessCodeRequired && (
              <label className="mt-4 block">
                <span className="mb-1 block text-[13px] font-medium text-ink-2">{t("accessCode")}</span>
                <input
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t("accessCodeHint")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                />
              </label>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={demoActive ? () => openDemo(demo!.id) : start}
                disabled={demoActive ? running : !canRun}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-ink text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-35"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {demoActive ? t("viewDemo") : t("run")}
              </button>
              {running && (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-ink-2 hover:text-ink"
                >
                  <Square className="h-3.5 w-3.5" />
                  {t("stop")}
                </button>
              )}
            </div>
            {demoActive && !running && (
              <button
                type="button"
                onClick={start}
                disabled={!canRun}
                className="mt-2 w-full text-center text-xs text-ink-3 underline underline-offset-2 hover:text-ink disabled:opacity-40"
              >
                {t("regenerate")}
              </button>
            )}
            {error && <p className="mt-3 rounded-md bg-bear-soft px-3 py-2 text-xs text-bear">{error}</p>}
          </Card>
        </aside>

        <div id="results" className="min-w-0 scroll-mt-16 space-y-6">
          {!run ? (
            <EmptyState />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Pipeline run={run} />
                {run.status !== "running" && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={copy} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-2 hover:bg-surface-2">
                      <Copy className="h-3.5 w-3.5" />
                      {copied ? t("copied") : "Markdown"}
                    </button>
                    <button type="button" onClick={download} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-ink-2 hover:bg-surface-2">
                      <Download className="h-3.5 w-3.5" />
                      {t("exportMd")}
                    </button>
                  </div>
                )}
              </div>
              {run.demo && (
                <p className="rounded-lg border border-accent/25 bg-accent-soft px-4 py-2.5 text-[13px] leading-relaxed text-ink-2">
                  {t("demoBanner", {
                    news: formatRange(run.demo.newsFrom, run.demo.newsTo),
                    date: new Date(run.demo.generatedAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US"),
                    provider: run.demo.provider === "deepseek" ? "DeepSeek" : "Gemini",
                  })}
                </p>
              )}
              {run.error && (
                <p className="rounded-lg border border-bear/30 bg-bear-soft px-4 py-2.5 text-sm text-bear">
                  {t("errorPrefix")}: {run.error}
                </p>
              )}

              <StoryCard run={run} />

              {(run.quotes.length > 0 || hasPending("market")) && (
                <div>
                  <SectionHeading>{t("market")}</SectionHeading>
                  <QuoteCards quotes={run.quotes} pending={hasPending("market")} />
                </div>
              )}

              <EvidenceList evidence={run.evidence} open={evidenceOpen} onToggle={() => setEvidenceOpen((v) => !v)} />

              <DocumentSection
                run={run}
                onCite={onCite}
                index={run.inputKind === "pdf" ? index : null}
                fileName={pdf.doc?.fileName ?? null}
                provider={settings.provider}
              />

              <AgentsSection run={run} onCite={onCite} />

              <ScorecardView card={run.scorecard} pending={run.status === "running" && run.agents.length > 0} onCite={onCite} />

              {run.meta && (
                <p className="text-xs text-ink-3 tabular">
                  {t("runMeta", {
                    s: (run.meta.ms / 1000).toFixed(0),
                    provider: run.meta.provider,
                    models: [...new Set(Object.values(run.meta.models))].join(", ") + (run.meta.retrieval ? ` · ${run.meta.retrieval}` : ""),
                  })}
                </p>
              )}
            </>
          )}
        </div>
      </main>

      <HistoryDrawer
        open={historyOpen}
        items={history}
        onClose={() => setHistoryOpen(false)}
        onOpen={(r) => {
          runRef.current = r;
          setRun(r);
          setHistoryOpen(false);
        }}
        onDelete={(id) => setHistory(deleteRun(id))}
      />
    </div>
  );
}
