// Regenerates the built-in demos: collects real headlines for each demo, runs the full
// pipeline once per language, and writes the finished result to public/demos/.
//
//   npm run demos                 # all demos, DeepSeek
//   npm run demos -- --only tesla --provider gemini
//   npm run demos -- --dry        # print the collected inputs only, no model calls
//   npm run demos -- --manifest   # rebuild public/demos/manifest.json from existing files

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DEMO_LANGS, DEMOS, newsDateRange, type DemoFile, type DemoManifest, type DemoSpec } from "@/config/demos";
import { newRun, reduce, type RunState } from "@/lib/client/run-state";
import { capabilities } from "@/lib/llm/providers";
import { runAnalysis } from "@/lib/pipeline/analyze";
import type { AnalyzeRequest } from "@/lib/schemas";
import { googleNews, yahooSymbolNews, type FeedItem } from "@/lib/tools/rss";
import type { Provider } from "@/lib/types";

const HEADLINES = 4;

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
    const inputText = await buildInput(demo);
    console.log(`\n${demo.id}: input ${inputText.length} chars`);
    if (process.argv.includes("--dry")) {
      console.log(inputText);
      continue;
    }
    for (const lang of DEMO_LANGS) {
      process.stdout.write(`  ${lang} … `);
      const t0 = Date.now();
      const run = await generate(demo, inputText, lang, provider);
      if (run.status !== "done" || !run.scorecard) {
        console.log(`failed: ${run.error ?? "no scorecard"}; keeping previous file`);
        continue;
      }
      const file: DemoFile = {
        id: demo.id,
        lang,
        generatedAt: new Date().toISOString(),
        provider,
        inputText,
        settings: demo.settings,
        run: { ...run, id: `demo-${demo.id}-${lang}` },
      };
      writeFileSync(`public/demos/${demo.id}.${lang}.json`, JSON.stringify(file));
      console.log(`ok (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }
  if (!process.argv.includes("--dry")) writeManifest();
}

/** Summarise every stored demo so the UI can show its news dates before it is opened. */
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

/**
 * Real, recent coverage for the demo: the primary ticker's Yahoo RSS (which carries article
 * summaries) filtered to the topic, or Google News for macro demos.
 */
async function buildInput(demo: DemoSpec): Promise<string> {
  const pool = demo.primaryTicker ? await yahooSymbolNews(demo.primaryTicker, 30) : [];
  let items = pool.filter((n) => demo.mustInclude.test(n.title));
  if (items.length < 3) items = [...items, ...(await googleNews(demo.query, 10)).filter((n) => demo.mustInclude.test(n.title))];
  items = items.slice(0, HEADLINES);
  if (!items.length) throw new Error(`No headlines found for ${demo.id}`);
  return items.map(formatItem).join("\n\n");
}

function formatItem(n: FeedItem) {
  const meta = `(${n.publisher ?? "Yahoo Finance"}, ${n.publishedAt?.slice(0, 10) ?? "undated"})`;
  return n.summary ? `${n.title} ${meta}\n${n.summary.slice(0, 450)}` : `${n.title} ${meta}`;
}

async function generate(demo: DemoSpec, text: string, lang: "en" | "zh", provider: Provider): Promise<RunState> {
  const req: AnalyzeRequest = {
    lang,
    provider,
    deepReasoning: false,
    temperature: 0.7,
    useWebSearch: false,
    settings: demo.settings,
    input: { kind: "text", text },
  };
  let run = newRun(demo.label[lang], "text", demo.settings.mode);
  try {
    await runAnalysis(req, (e) => (run = reduce(run, e)));
  } catch (err) {
    run = { ...run, status: "error", error: err instanceof Error ? err.message : String(err) };
  }
  // Reasoning traces are not shown for demos and only add weight.
  return { ...run, agents: run.agents.map((a) => ({ ...a, reasoning: "" })) };
}

main();
