// Orchestrates one analysis run and reports progress through `emit`.
// Used by /api/analyze (streamed to the browser) and by the eval script (collected in memory).

import { NoObjectGeneratedError, Output, generateText, streamText } from "ai";
import { modelId } from "@/config/models";
import { getPersona, type Persona } from "@/config/personas";
import { getModel, capabilities, type ModelCall } from "@/lib/llm/providers";
import { analystPrompt, analystSystem, documentPrompt, documentSystem, rebuttalPrompt, rebuttalSystem, type ContextPack } from "@/lib/prompts/analyst";
import { LABEL_SYSTEM, labelPrompt } from "@/lib/prompts/context";
import { KPI_SYSTEM, kpiPrompt } from "@/lib/prompts/document";
import { EXTRACT_SYSTEM, extractPrompt } from "@/lib/prompts/extract";
import { pmPrompt, pmSystem } from "@/lib/prompts/pm";
import { formatEvidence } from "@/lib/prompts/shared";
import { contextLabelSchema, extractionSchema, kpiSchema, scorecardSchema, type AnalyzeRequest } from "@/lib/schemas";
import { describeQuotes, getQuotes, resolveSymbols } from "@/lib/tools/market";
import { relatedNews, webResearch } from "@/lib/tools/news";
import type { AgentInfo, Evidence, Extraction, Lang, Provider, Quote, Scorecard, ScoreItem, Stance, StreamEvent } from "@/lib/types";

export type Emit = (event: StreamEvent) => void;

const EXTRACT_CHAR_LIMIT = 12_000;
const MIN_RELEVANCE = 0.25;

interface AgentJob {
  info: AgentInfo;
  system: string;
  prompt: string;
}

export async function runAnalysis(req: AnalyzeRequest, emit: Emit, signal?: AbortSignal) {
  const started = Date.now();
  const { lang, provider, deepReasoning, temperature } = req;
  const caps = capabilities();
  if (!caps.providers[provider]) throw new Error(`Provider "${provider}" is not configured on the server.`);

  // Model roles. When a call fails on quota or overload and the other provider is configured,
  // that step is retried on the other provider and marked "(fallback)" in the run metadata.
  type Role = "fast" | "writer" | "structured";
  const pick = (p: Provider, role: Role): ModelCall =>
    role === "fast"
      ? getModel(p, "fast", { structured: true })
      : role === "writer"
        ? getModel(p, deepReasoning ? "deep" : "main", { temperature })
        : getModel(p, "main", { structured: true });
  const other: Provider = provider === "deepseek" ? "gemini" : "deepseek";
  const backup = caps.providers[other] ? other : null;
  const models: Record<string, string> = {
    extract: pick(provider, "fast").modelId,
    analysts: pick(provider, "writer").modelId,
    pm: pick(provider, "structured").modelId,
  };

  /**
   * One structured call with recovery: malformed JSON is retried once on the same model,
   * then quota/overload/malformed failures move to the backup provider if one is configured.
   */
  async function call<T>(label: string, role: Role, run: (m: ModelCall) => Promise<T>): Promise<T> {
    const primary = pick(provider, role);
    try {
      return await run(primary);
    } catch (first) {
      if (signal?.aborted) throw first;
      let err = first;
      if (NoObjectGeneratedError.isInstance(first)) {
        try {
          return await run(primary);
        } catch (second) {
          err = second;
        }
      }
      if (!backup || signal?.aborted || !(isCapacityError(err) || NoObjectGeneratedError.isInstance(err))) throw err;
      const m = pick(backup, role);
      models[label] = `${m.modelId} (fallback)`;
      return run(m);
    }
  }
  const writers = [pick(provider, "writer"), ...(backup ? [pick(backup, "writer")] : [])];
  const onWriterFallback = (id: string) => (models.analysts = `${id} (fallback)`);

  // ---- 1. Extraction ----
  const isPdf = req.input.kind === "pdf";
  const pdfEvidence: Evidence[] =
    req.input.kind === "pdf"
      ? req.input.chunks.map((c) => ({
          id: c.id,
          kind: "pdf",
          title: `${(req.input as { fileName: string }).fileName} · p.${c.page}`,
          page: c.page,
          text: c.text,
        }))
      : [];
  const sourceText = req.input.kind === "text" ? req.input.text : pdfEvidence.map((e) => e.text).join("\n\n");

  emit({ type: "stage", stage: "extract", status: "running" });
  const { output: rawExtraction } = await call("extract", "fast", (m) =>
    generateText({
      ...m,
      system: EXTRACT_SYSTEM,
      prompt: extractPrompt(
        sourceText.slice(0, EXTRACT_CHAR_LIMIT),
        req.input.kind,
        lang,
        req.input.kind === "pdf" ? req.input.fileName : undefined,
      ),
      output: Output.object({ schema: extractionSchema }),
      abortSignal: signal,
    }),
  );
  const extraction = normalizeExtraction(rawExtraction);
  emit({ type: "extraction", data: extraction });
  emit({ type: "stage", stage: "extract", status: "done" });

  // ---- 2. Market data, related news and web research in parallel ----
  const webEnabled = req.useWebSearch && caps.webSearch;
  emit({ type: "stage", stage: "market", status: "running" });
  emit({ type: "stage", stage: "news", status: "running" });
  emit({ type: "stage", stage: "web", status: webEnabled ? "running" : "skipped" });

  const marketTask = (async () => {
    const symbols = await resolveSymbols(extraction.entities);
    const quotes = await getQuotes(symbols);
    emit({ type: "quotes", data: quotes });
    emit({ type: "stage", stage: "market", status: "done", detail: quotes.map((q) => q.symbol).join(", ") });
    return quotes;
  })().catch((err) => {
    emit({ type: "stage", stage: "market", status: "error", detail: errorText(err) });
    return [] as Quote[];
  });

  const newsTask = marketTask
    .then((quotes) => relatedNews(quotes, extraction))
    .then((news) => {
      emit({ type: "stage", stage: "news", status: "done", detail: String(news.length) });
      return news;
    })
    .catch((err) => {
      emit({ type: "stage", stage: "news", status: "error", detail: errorText(err) });
      return [] as Evidence[];
    });

  const webTask = webEnabled
    ? webResearch(extraction, lang, signal)
        .then((r) => {
          emit({ type: "stage", stage: "web", status: "done", detail: String(r.sources.length) });
          return r;
        })
        .catch((err) => {
          emit({ type: "stage", stage: "web", status: "error", detail: errorText(err) });
          return null;
        })
    : Promise.resolve(null);

  const [quotes, rawNews, web] = await Promise.all([marketTask, newsTask, webTask]);
  if (web) models.web = web.engine === "gemini" ? modelId("gemini", "fast") : web.engine;

  // ---- 3. Label headline sentiment and relevance ----
  let news = rawNews;
  if (news.length) {
    emit({ type: "stage", stage: "context", status: "running" });
    try {
      const { output } = await call("context", "fast", (m) =>
        generateText({
          ...m,
          system: LABEL_SYSTEM,
          prompt: labelPrompt(extraction, news, lang),
          output: Output.object({ schema: contextLabelSchema }),
          abortSignal: signal,
        }),
      );
      const labels = new Map(output.items.map((i) => [i.id, i]));
      news = news.map((n) => {
        const l = labels.get(n.id);
        return l ? { ...n, sentiment: l.sentiment, relevance: clamp(l.relevance, 0, 1), note: l.note } : n;
      });
      emit({ type: "stage", stage: "context", status: "done" });
    } catch (err) {
      emit({ type: "stage", stage: "context", status: "error", detail: errorText(err) });
    }
  } else {
    emit({ type: "stage", stage: "context", status: "skipped" });
  }

  const inputEvidence: Evidence[] =
    req.input.kind === "text"
      ? [{ id: "S1", kind: "input", title: extraction.headline, source: lang === "zh" ? "用户输入" : "User input", text: req.input.text }]
      : pdfEvidence;
  const allEvidence = [...inputEvidence, ...news, ...(web?.sources ?? [])];
  emit({ type: "evidence", data: allEvidence.map(forClient) });

  const promptEvidence = allEvidence.filter((e) => e.kind !== "news" || (e.relevance ?? 1) >= MIN_RELEVANCE);
  const ctx: ContextPack = {
    asOf: new Date().toISOString().slice(0, 10),
    headline: `${extraction.headline}\n${extraction.summary}`,
    evidenceText: formatEvidence(promptEvidence),
    marketText: describeQuotes(quotes),
    webBrief: web?.brief ?? null,
  };

  // ---- 4. Analysts (round 1), plus document review and KPIs for PDFs ----
  const jobs = planAgents(req, ctx, lang);
  emit({ type: "stage", stage: "analysts", status: "running", detail: String(jobs.length) });

  const kpiTask = isPdf
    ? (async () => {
        emit({ type: "stage", stage: "kpis", status: "running" });
        try {
          const { output } = await call("kpis", "structured", (m) =>
            generateText({
              ...m,
              system: KPI_SYSTEM,
              prompt: kpiPrompt(formatEvidence(pdfEvidence), lang),
              output: Output.object({ schema: kpiSchema }),
              abortSignal: signal,
            }),
          );
          const valid = new Set(pdfEvidence.map((e) => e.id));
          const kpis = output.kpis.filter((k) => valid.has(k.evidence)).slice(0, 12);
          emit({ type: "kpis", data: kpis });
          emit({ type: "stage", stage: "kpis", status: "done", detail: String(kpis.length) });
        } catch (err) {
          emit({ type: "stage", stage: "kpis", status: "error", detail: errorText(err) });
        }
      })()
    : Promise.resolve();

  const round1 = await Promise.all(jobs.map((job) => runAgent(job, writers, emit, signal, onWriterFallback)));
  await kpiTask;
  emit({ type: "stage", stage: "analysts", status: "done" });

  const commentaries = jobs
    .map((job, i) => ({ info: job.info, text: round1[i] }))
    .filter((c) => c.text);

  // ---- 5. Rebuttal round for debates ----
  if (req.settings.mode === "debate" && req.settings.rebuttal) {
    const bull = commentaries.find((c) => c.info.id === "bull");
    const bear = commentaries.find((c) => c.info.id === "bear");
    if (bull && bear) {
      emit({ type: "stage", stage: "rebuttal", status: "running" });
      const s = req.settings;
      const rebuttals: AgentJob[] = [
        rebuttalJob("bull", "bullish", getPersona(s.bullPersona), ctx, bull.text, bear.text, lang),
        rebuttalJob("bear", "bearish", getPersona(s.bearPersona), ctx, bear.text, bull.text, lang),
      ];
      const texts = await Promise.all(rebuttals.map((job) => runAgent(job, writers, emit, signal, onWriterFallback)));
      rebuttals.forEach((job, i) => texts[i] && commentaries.push({ info: job.info, text: texts[i] }));
      emit({ type: "stage", stage: "rebuttal", status: "done" });
    }
  }

  // ---- 6. PM scorecard ----
  if (commentaries.length) {
    emit({ type: "stage", stage: "pm", status: "running" });
    try {
      const { output } = await call("pm", "structured", (m) =>
        generateText({
          ...m,
          system: pmSystem(lang),
          prompt: pmPrompt(ctx.asOf, ctx.evidenceText, ctx.marketText, commentaries.map((c) => ({ title: c.info.title, text: c.text }))),
          output: Output.object({ schema: scorecardSchema }),
          abortSignal: signal,
        }),
      );
      emit({ type: "scorecard", data: normalizeScorecard(output) });
      emit({ type: "stage", stage: "pm", status: "done" });
    } catch (err) {
      emit({ type: "stage", stage: "pm", status: "error", detail: errorText(err) });
    }
  }

  emit({
    type: "done",
    meta: {
      ms: Date.now() - started,
      provider,
      models,
      retrieval: req.input.kind === "pdf" ? req.input.retrieval : undefined,
    },
  });
}

// ---------------------------------------------------------------------------

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

function normalizeExtraction(x: Extraction): Extraction {
  return {
    ...x,
    // Some models answer confidence on a 0-100 scale.
    entities: x.entities.slice(0, 8).map((e) => ({ ...e, confidence: clamp(e.confidence > 1 ? e.confidence / 100 : e.confidence, 0, 1) })),
    keyFacts: x.keyFacts.slice(0, 8),
    searchQueries: x.searchQueries.slice(0, 3),
  };
}

const DIMENSIONS: ScoreItem["dimension"][] = ["fundamentals", "momentum", "sentiment", "valuation", "risk"];

/** Exactly one score per dimension, values in range, lists trimmed. */
function normalizeScorecard(c: Scorecard): Scorecard {
  const scores = DIMENSIONS.map(
    (d) =>
      c.scores.find((s) => s.dimension === d) ?? { dimension: d, score: 50, rationale: "No evidence available for this dimension.", evidence: [] },
  ).map((s) => ({ ...s, score: clamp(s.score, 0, 100) }));
  return {
    ...c,
    verdict: { ...c.verdict, conviction: Math.round(clamp(c.verdict.conviction, 1, 5)) },
    scores,
    agreements: c.agreements.slice(0, 5),
    disagreements: c.disagreements.slice(0, 5),
    keyRisks: c.keyRisks.slice(0, 5),
    catalysts: c.catalysts.slice(0, 5),
    dataGaps: c.dataGaps.slice(0, 5),
  };
}

function planAgents(req: AnalyzeRequest, ctx: ContextPack, lang: Lang): AgentJob[] {
  const jobs: AgentJob[] = [];
  const s = req.settings;

  if (req.input.kind === "pdf") {
    jobs.push({
      info: { id: "doc", role: "document", stance: null, personaId: null, title: lang === "zh" ? "文档分析师" : "Document Analyst" },
      system: documentSystem(lang),
      prompt: documentPrompt(ctx, req.input.fileName),
    });
  }

  if (s.mode === "debate") {
    for (const [id, stance, personaId] of [
      ["bull", "bullish", s.bullPersona],
      ["bear", "bearish", s.bearPersona],
    ] as const) {
      const persona = getPersona(personaId);
      jobs.push({
        info: { id, role: "analyst", stance, personaId: persona?.id ?? null, title: agentTitle(stance, persona, lang) },
        system: analystSystem(stance, s.strength, persona, lang),
        prompt: analystPrompt(ctx),
      });
    }
    return jobs;
  }

  const personas = s.personas.length ? s.personas.map((p) => getPersona(p)) : [null];
  personas.forEach((persona, i) => {
    jobs.push({
      info: { id: `a${i + 1}`, role: "analyst", stance: s.stance, personaId: persona?.id ?? null, title: agentTitle(s.stance, persona, lang) },
      system: analystSystem(s.stance, s.strength, persona, lang),
      prompt: analystPrompt(ctx),
    });
  });
  return jobs;
}

function rebuttalJob(
  side: "bull" | "bear",
  stance: Stance,
  persona: Persona | null,
  ctx: ContextPack,
  own: string,
  opponent: string,
  lang: Lang,
): AgentJob {
  const label = lang === "zh" ? (side === "bull" ? "多方反驳" : "空方反驳") : side === "bull" ? "Bull rebuttal" : "Bear rebuttal";
  return {
    info: { id: `${side}-rebuttal`, role: "rebuttal", stance, personaId: persona?.id ?? null, title: label },
    system: rebuttalSystem(stance, persona, lang),
    prompt: rebuttalPrompt(ctx, own, opponent),
  };
}

/** Stream one agent. Moves to the next model only if the failure happened before any text arrived. */
async function runAgent(
  job: AgentJob,
  candidates: ModelCall[],
  emit: Emit,
  signal: AbortSignal | undefined,
  onFallback: (modelId: string) => void,
) {
  emit({ type: "agent-start", agent: job.info });
  let text = "";
  for (let i = 0; i < candidates.length; i++) {
    try {
      const result = streamText({ ...candidates[i], system: job.system, prompt: job.prompt, abortSignal: signal });
      for await (const part of result.stream) {
        if (part.type === "text-delta") {
          text += part.text;
          emit({ type: "agent-delta", agentId: job.info.id, channel: "text", text: part.text });
        } else if (part.type === "reasoning-delta") {
          emit({ type: "agent-delta", agentId: job.info.id, channel: "reasoning", text: part.text });
        } else if (part.type === "error") {
          throw part.error;
        }
      }
      emit({ type: "agent-end", agentId: job.info.id });
      return text;
    } catch (err) {
      const next = candidates[i + 1];
      if (next && !text && !signal?.aborted && isCapacityError(err)) {
        onFallback(next.modelId);
        continue;
      }
      emit({ type: "agent-end", agentId: job.info.id, error: errorText(err) });
      return text;
    }
  }
  return text;
}

/** Quota, rate-limit and overload errors: worth retrying on the other provider. */
function isCapacityError(err: unknown) {
  const e = err as { statusCode?: number; lastError?: { statusCode?: number } } | undefined;
  const status = e?.lastError?.statusCode ?? e?.statusCode;
  return status === 429 || status === 503 || /quota|rate.?limit|high demand|overloaded|resource.?exhausted|unavailable/i.test(errorText(err));
}

function agentTitle(stance: Stance, persona: Persona | null, lang: Lang) {
  const base = {
    en: { bullish: "Bull Analyst", bearish: "Bear Analyst", neutral: "Neutral Analyst" },
    zh: { bullish: "多头分析师", bearish: "空头分析师", neutral: "中性分析师" },
  }[lang][stance];
  return persona ? `${base} · ${persona.name[lang]}` : base;
}

/** Trim long texts before sending evidence to the browser; the model already has the full text. */
function forClient(e: Evidence): Evidence {
  return e.text && e.text.length > 700 ? { ...e, text: e.text.slice(0, 700) + "…" } : e;
}

export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 300);
  return String(err).slice(0, 300);
}
