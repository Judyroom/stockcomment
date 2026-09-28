// Regenerates the built-in demos: collects each demo's real, dated input (headlines or a
// public PDF), runs the full pipeline once per language, and writes the result to public/demos/.
//
//   npm run demos                 # all demos, DeepSeek
//   npm run demos -- --only tesla --provider gemini
//   npm run demos -- --only meta-q2-2026 --lang zh
//   npm run demos -- --dry        # print the collected inputs only, no model calls
//   npm run demos -- --manifest   # rebuild public/demos/manifest.json from existing files
//
// PDF demos are downloaded to scripts/.cache/ (git-ignored) and are not redistributed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  DEMO_LANGS,
  DEMOS,
  headlineLine,
  newsDateRange,
  type DemoFile,
  type DemoHeadline,
  type DemoManifest,
  type DemoSpec,
  type PdfDemo,
  type SearchDemo,
  type TextDemo,
} from "@/config/demos";
import { DocIndex, selectForAnalysis } from "@/lib/client/retriever";
import { newRun, reduce, type RunState } from "@/lib/client/run-state";
import { capabilities } from "@/lib/llm/providers";
import { parsePdfData } from "@/lib/pdf-core";
import { runAnalysis } from "@/lib/pipeline/analyze";
import type { AnalyzeRequest } from "@/lib/schemas";
import { googleNews, yahooSymbolNews, type FeedItem } from "@/lib/tools/rss";
import type { Provider } from "@/lib/types";

const TEXT_HEADLINES = 4;
const SEARCH_HEADLINES = 3;
const PDF_PREVIEW_CHARS = 200;

interface Prepared {
  inputText: string;
  input: AnalyzeRequest["input"];
  headlines?: DemoHeadline[];
  pdf?: DemoFile["pdf"];
}

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  if (process.argv.includes("--manifest")) {
    writeManifest();
    return;
  }
  const provider = (arg("provider") ?? "deepseek") as Provider;
  if (!capabilities().providers[provider]) {
    console.error(`${provider} is not configured. Add its key to .env.local.`);
    process.exit(1);
  }
  const only = arg("only")?.split(",");
  mkdirSync("public/demos", { recursive: true });

  for (const demo of DEMOS.filter((d) => !only || only.includes(d.id))) {
    const prepared = await prepare(demo);
    console.log(`\n${demo.id} (${demo.kind}): input ${prepared.inputText.length} chars`);
    if (process.argv.includes("--dry")) {
      console.log(prepared.inputText);
      if (prepared.pdf) console.log(`pdf: ${prepared.pdf.pageCount} pages, ${prepared.pdf.retrieval}`);
      continue;
    }
    for (const lang of DEMO_LANGS.filter((l) => !arg("lang") || l === arg("lang"))) {
      process.stdout.write(`  ${lang} … `);
      const t0 = Date.now();
      const run = await generate(demo, prepared, lang, provider);
      if (run.status !== "done" || !run.scorecard) {
        console.log(`failed: ${run.error ?? "no scorecard"}; keeping previous file`);
        continue;
      }
      const file: DemoFile = {
        id: demo.id,
        kind: demo.kind,
        lang,
        generatedAt: new Date().toISOString(),
        provider,
        inputText: prepared.inputText,
        settings: demo.settings,
        headlines: prepared.headlines,
        pdf: prepared.pdf,
        run: { ...run, id: `demo-${demo.id}-${lang}` },
      };
      writeFileSync(`public/demos/${demo.id}.${lang}.json`, JSON.stringify(file));
      console.log(`ok (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }
  if (!process.argv.includes("--dry")) writeManifest();
}

/** Summarise every stored demo so the UI can show its dates before it is opened. */
function writeManifest() {
  const manifest: DemoManifest = { items: {} };
  for (const demo of DEMOS) {
    const files = DEMO_LANGS.map((l) => `public/demos/${demo.id}.${l}.json`).filter((f) => existsSync(f));
    if (!files.length) continue;
    const parsed = files.map((f) => JSON.parse(readFileSync(f, "utf8")) as DemoFile);
    const latest = parsed.map((p) => p.generatedAt).sort().at(-1)!;
    manifest.items[demo.id] = { ...newsDateRange(parsed[0].inputText), generatedAt: latest };
  }
  writeFileSync("public/demos/manifest.json", JSON.stringify(manifest, null, 2));
  console.log(`manifest: ${Object.keys(manifest.items).length} demos`);
}

function prepare(demo: DemoSpec): Promise<Prepared> {
  if (demo.kind === "search") return prepareSearch(demo);
  if (demo.kind === "pdf") return preparePdf(demo);
  return prepareText(demo);
}

/**
 * Real, recent coverage for a text demo: the primary ticker's Yahoo RSS (which carries article
 * summaries) filtered to the topic, topped up from Google News.
 */
async function prepareText(demo: TextDemo): Promise<Prepared> {
  const pool = demo.primaryTicker ? await yahooSymbolNews(demo.primaryTicker, 30) : [];
  let items = pool.filter((n) => demo.mustInclude.test(n.title));
  if (items.length < 3) items = [...items, ...(await googleNews(demo.query, 10)).filter((n) => demo.mustInclude.test(n.title))];
  items = items.slice(0, TEXT_HEADLINES);
  if (!items.length) throw new Error(`No headlines found for ${demo.id}`);
  const inputText = items.map(formatItem).join("\n\n");
  return { inputText, input: { kind: "text", text: inputText } };
}

function formatItem(n: FeedItem) {
  const meta = `(${n.publisher ?? "Yahoo Finance"}, ${n.publishedAt?.slice(0, 10) ?? "undated"})`;
  return n.summary ? `${n.title} ${meta}\n${n.summary.slice(0, 450)}` : `${n.title} ${meta}`;
}

/** One headline per listed publisher (newest first), formatted exactly as the Search tab does. */
async function prepareSearch(demo: SearchDemo): Promise<Prepared> {
  const pool = (await googleNews(demo.query, 100, 30, demo.locale)).filter((n) => demo.mustInclude.test(n.title));
  const picked: FeedItem[] = [];
  for (const publisher of demo.publishers) {
    const hit = pool.filter((n) => n.publisher === publisher).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))[0];
    if (hit) picked.push(hit);
  }
  if (picked.length < SEARCH_HEADLINES) throw new Error(`${demo.id}: found ${picked.length}/${SEARCH_HEADLINES} headlines from ${demo.publishers.join(", ")}`);
  const headlines: DemoHeadline[] = picked.map((n) => ({
    uuid: n.link,
    title: n.title,
    publisher: n.publisher ?? "",
    link: n.link,
    publishedAt: n.publishedAt,
    tickers: [],
  }));
  const inputText = headlines.map(headlineLine).join("\n");
  return { inputText, input: { kind: "text", text: inputText }, headlines };
}

/** Parse the public PDF with the same chunking and selection as a browser upload. */
async function preparePdf(demo: PdfDemo): Promise<Prepared> {
  mkdirSync("scripts/.cache", { recursive: true });
  const cache = `scripts/.cache/${demo.id}.pdf`;
  if (!existsSync(cache)) {
    const res = await fetch(demo.sourceUrl);
    if (!res.ok) throw new Error(`${demo.id}: download failed (${res.status})`);
    writeFileSync(cache, new Uint8Array(await res.arrayBuffer()));
  }
  const parsed = await parsePdfData(pdfjs as unknown as typeof import("pdfjs-dist"), new Uint8Array(readFileSync(cache)), demo.fileName);
  const { chunks, retrieval } = await selectForAnalysis(new DocIndex(parsed.chunks));
  return {
    inputText: `${demo.docTitle} (${demo.publisher}, ${demo.docDate})`,
    input: { kind: "pdf", fileName: demo.fileName, pageCount: parsed.pageCount, retrieval, chunks },
    pdf: {
      fileName: demo.fileName,
      sourceUrl: demo.sourceUrl,
      pageCount: parsed.pageCount,
      retrieval,
      docTitle: demo.docTitle,
      docDate: demo.docDate,
      publisher: demo.publisher,
    },
  };
}

async function generate(demo: DemoSpec, prepared: Prepared, lang: "en" | "zh", provider: Provider): Promise<RunState> {
  const req: AnalyzeRequest = {
    lang,
    provider,
    deepReasoning: false,
    temperature: 0.7,
    useWebSearch: false,
    settings: demo.settings,
    input: prepared.input,
  };
  let run = newRun(demo.label[lang], prepared.input.kind, demo.settings.mode);
  try {
    await runAnalysis(req, (e) => (run = reduce(run, e)));
  } catch (err) {
    run = { ...run, status: "error", error: err instanceof Error ? err.message : String(err) };
  }
  // Reasoning traces are not shown for demos and only add weight. PDF excerpts are cut to a short
  // preview so the stored demo does not republish the document; the source link has the full text.
  return {
    ...run,
    agents: run.agents.map((a) => ({ ...a, reasoning: "" })),
    evidence: run.evidence.map((e) => (e.kind === "pdf" && e.text ? { ...e, text: preview(e.text) } : e)),
  };
}

function preview(text: string) {
  return text.length > PDF_PREVIEW_CHARS ? text.slice(0, PDF_PREVIEW_CHARS).trimEnd() + "…" : text;
}

main();
