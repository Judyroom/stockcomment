// Offline evaluation: runs the full pipeline on the demo inputs with each configured provider,
// scores the outputs, and writes a Markdown report to eval/results/.
//
//   npm run eval                      # all configured providers
//   npm run eval -- --providers gemini --mode single
//
// Automatic metrics are computed from the output. The judge score comes from the *other*
// provider when both are configured, to reduce self-preference bias.

import { mkdirSync, writeFileSync } from "node:fs";
import { Output, generateText } from "ai";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { DEMOS, type DemoFile } from "@/config/demos";
import { capabilities, getModel } from "@/lib/llm/providers";
import { runAnalysis } from "@/lib/pipeline/analyze";
import { PROMPT_VERSION } from "@/lib/prompts/shared";
import type { AnalyzeRequest } from "@/lib/schemas";
import type { Provider, StreamEvent } from "@/lib/types";

// Inputs are the built-in demo cases (real headlines captured by `npm run demos`).
const SAMPLES = DEMOS.map((d) => ({
  id: d.id,
  primaryTicker: d.primaryTicker,
  text: (JSON.parse(readFileSync(`public/demos/${d.id}.en.json`, "utf8")) as DemoFile).inputText,
}));

const judgeSchema = z.object({
  stanceConsistency: z.number().int().min(1).max(5),
  groundedness: z.number().int().min(1).max(5),
  engagement: z.number().int().min(1).max(5).describe("How directly the rebuttals answer the other side"),
  clarity: z.number().int().min(1).max(5),
  notes: z.string(),
});

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const caps = capabilities();
  const wanted = (arg("providers")?.split(",") as Provider[] | undefined) ?? (["deepseek", "gemini"] as Provider[]);
  const providers = wanted.filter((p) => caps.providers[p]);
  if (!providers.length) {
    console.error("No configured providers. Set DEEPSEEK_API_KEY and/or GOOGLE_GENERATIVE_AI_API_KEY in .env.local.");
    process.exit(1);
  }
  const mode = arg("mode") === "single" ? "single" : "debate";
  const rows: Row[] = [];

  for (const provider of providers) {
    for (const sample of SAMPLES) {
      process.stdout.write(`${provider} / ${sample.id} … `);
      const req: AnalyzeRequest = {
        lang: "en",
        provider,
        deepReasoning: false,
        temperature: 0.7,
        useWebSearch: false,
        settings:
          mode === "single"
            ? { mode: "single", stance: "neutral", strength: "moderate", personas: [] }
            : { mode: "debate", strength: "moderate", bullPersona: null, bearPersona: null, rebuttal: true },
        input: { kind: "text", text: sample.text },
      };
      const events: StreamEvent[] = [];
      const t0 = Date.now();
      try {
        await runAnalysis(req, (e) => events.push(e));
        const row = await score(sample.id, provider, events, Date.now() - t0, providers);
        rows.push(row);
        console.log(`ok (${(row.ms / 1000).toFixed(0)}s)`);
      } catch (err) {
        console.log("failed:", err instanceof Error ? err.message : err);
        rows.push({ sample: sample.id, provider, ms: Date.now() - t0, error: String(err) } as Row);
      }
    }
  }

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  mkdirSync("eval/results", { recursive: true });
  writeFileSync(`eval/results/${stamp}.json`, JSON.stringify(rows, null, 2));
  writeFileSync(`eval/results/${stamp}.md`, report(rows, mode));
  console.log(`\nWrote eval/results/${stamp}.md`);
}

interface Row {
  sample: string;
  provider: Provider;
  ms: number;
  tickerHit: number | null;
  citationValidity: number;
  citationsPer100Words: number;
  words: number;
  scorecard: boolean;
  judge?: z.infer<typeof judgeSchema> & { by: Provider };
  error?: string;
}

async function score(sample: string, provider: Provider, events: StreamEvent[], ms: number, providers: Provider[]): Promise<Row> {
  const evidence = new Set((events.find((e) => e.type === "evidence") as { data: { id: string }[] } | undefined)?.data.map((e) => e.id));
  evidence.add("M");

  const texts = new Map<string, string>();
  const titles = new Map<string, string>();
  for (const e of events) {
    if (e.type === "agent-start") titles.set(e.agent.id, e.agent.title);
    if (e.type === "agent-delta" && e.channel === "text") texts.set(e.agentId, (texts.get(e.agentId) ?? "") + e.text);
  }
  const all = [...texts.values()].join("\n");
  const cites = [...all.matchAll(/\[((?:[SNWPM][\d.]*)(?:\s*,\s*[SNWPM][\d.]*)*)\]/g)].flatMap((m) => m[1].split(",").map((s) => s.trim()));
  const words = all.split(/\s+/).filter(Boolean).length;

  const quotes = (events.find((e) => e.type === "quotes") as { data: { symbol: string }[] } | undefined)?.data ?? [];
  const primary = SAMPLES.find((s) => s.id === sample)!.primaryTicker;
  const tickerHit = primary ? (quotes.some((q) => q.symbol === primary) ? 1 : 0) : null;

  const row: Row = {
    sample,
    provider,
    ms,
    tickerHit,
    citationValidity: cites.length ? cites.filter((c) => evidence.has(c)).length / cites.length : 0,
    citationsPer100Words: words ? (cites.length / words) * 100 : 0,
    words,
    scorecard: events.some((e) => e.type === "scorecard"),
  };

  const judgeProvider = providers.find((p) => p !== provider) ?? provider;
  try {
    const source = SAMPLES.find((s) => s.id === sample)!.text;
    const { output } = await generateText({
      ...getModel(judgeProvider, "main", { structured: true }),
      output: Output.object({ schema: judgeSchema }),
      system: "You grade AI-generated market commentary strictly. 1 = poor, 5 = excellent. Penalise figures that do not appear in the source or evidence.",
      prompt: `Source news:\n${source}\n\n${[...texts.entries()].map(([id, t]) => `## ${titles.get(id)}\n${t}`).join("\n\n")}\n\nGrade the set of commentaries.`,
    });
    row.judge = { ...output, by: judgeProvider };
  } catch (err) {
    row.error = `judge: ${err instanceof Error ? err.message : err}`;
  }
  return row;
}

function report(rows: Row[], mode: string) {
  const avg = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => typeof x === "number");
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : "—";
  };
  const providers = [...new Set(rows.map((r) => r.provider))];
  const lines = [
    `# Eval report`,
    "",
    `Prompt version ${PROMPT_VERSION} · mode ${mode} · ${new Date().toISOString()}`,
    "",
    "| Provider | Primary ticker hit | Citation validity | Citations / 100 words | Stance | Grounded | Engagement | Clarity | Avg seconds |",
    "|---|---|---|---|---|---|---|---|---|",
    ...providers.map((p) => {
      const r = rows.filter((x) => x.provider === p);
      return `| ${p} | ${avg(r.map((x) => x.tickerHit))} | ${avg(r.map((x) => x.citationValidity))} | ${avg(r.map((x) => x.citationsPer100Words))} | ${avg(r.map((x) => x.judge?.stanceConsistency))} | ${avg(r.map((x) => x.judge?.groundedness))} | ${avg(r.map((x) => x.judge?.engagement))} | ${avg(r.map((x) => x.judge?.clarity))} | ${avg(r.map((x) => x.ms / 1000))} |`;
    }),
    "",
    "## Per sample",
    "",
    "| Sample | Provider | Tickers | Cite valid | Words | Judge (by) | Notes |",
    "|---|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.sample} | ${r.provider} | ${r.tickerHit ?? "n/a"} | ${r.citationValidity?.toFixed(2) ?? "—"} | ${r.words ?? "—"} | ${r.judge ? `${r.judge.groundedness}/${r.judge.stanceConsistency} (${r.judge.by})` : "—"} | ${(r.error ?? r.judge?.notes ?? "").replace(/\|/g, "/").slice(0, 160)} |`,
    ),
  ];
  return lines.join("\n") + "\n";
}

main();
