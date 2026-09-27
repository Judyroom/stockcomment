import { z } from "zod";

// ---- Request validation (API input) ----

const persona = z.string().max(40).nullable();

export const analysisSettingsSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("single"),
    stance: z.enum(["bullish", "bearish", "neutral"]),
    strength: z.enum(["strong", "moderate", "mild"]),
    personas: z.array(z.string().max(40)).max(3),
  }),
  z.object({
    mode: z.literal("debate"),
    strength: z.enum(["strong", "moderate", "mild"]),
    bullPersona: persona,
    bearPersona: persona,
    rebuttal: z.boolean(),
  }),
]);

export const pdfChunkSchema = z.object({
  id: z.string().max(20),
  page: z.number().int().min(1),
  text: z.string().max(6000),
});

export const analyzeRequestSchema = z.object({
  lang: z.enum(["en", "zh"]),
  provider: z.enum(["deepseek", "gemini"]),
  deepReasoning: z.boolean(),
  temperature: z.number().min(0).max(1.5),
  useWebSearch: z.boolean(),
  settings: analysisSettingsSchema,
  input: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("text"), text: z.string().min(10).max(20000) }),
    z.object({
      kind: z.literal("pdf"),
      fileName: z.string().max(200),
      pageCount: z.number().int().min(1),
      retrieval: z.string().max(80),
      chunks: z.array(pdfChunkSchema).min(1).max(400),
    }),
  ]),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalysisSettings = z.infer<typeof analysisSettingsSchema>;

export const askRequestSchema = z.object({
  lang: z.enum(["en", "zh"]),
  provider: z.enum(["deepseek", "gemini"]),
  question: z.string().min(2).max(1000),
  fileName: z.string().max(200),
  chunks: z.array(pdfChunkSchema).min(1).max(400),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(10),
});

export const embedRequestSchema = z.object({
  texts: z.array(z.string().min(1).max(6000)).min(1).max(100),
  task: z.enum(["document", "query"]),
});

export const newsSearchRequestSchema = z.object({
  query: z.string().min(1).max(100),
});

// ---- Model output schemas (structured generation) ----
// Limits live in the descriptions, not as hard constraints: DeepSeek's JSON mode does not
// enforce a schema, so an extra item or a 0-100 confidence would fail the whole call.
// The pipeline trims and clamps after parsing (see normalize* in lib/pipeline/analyze.ts).

export const extractionSchema = z.object({
  headline: z.string().describe("One-line headline of what happened"),
  summary: z.string().describe("2-3 sentence neutral summary"),
  eventType: z
    .string()
    .describe("e.g. earnings, guidance, M&A, regulation, macro, product, legal, management"),
  entities: z
    .array(
      z.object({
        name: z.string().describe("Official English name, e.g. Tencent Holdings, even if the text is Chinese"),
        ticker: z
          .string()
          .nullable()
          .describe("Yahoo Finance symbol, e.g. AAPL, 0700.HK, 9988.HK, BRK-B, ^GSPC. null if unknown"),
        type: z.enum(["company", "index", "sector", "macro", "person", "other"]),
        role: z
          .enum(["subject", "mentioned"])
          .describe("subject = the story is about it; mentioned = cited in passing, e.g. brokers issuing forecasts, sources, peers"),
        confidence: z.number().describe("0 to 1"),
      }),
    )
    .describe("At most 8"),
  keyFacts: z.array(z.string()).describe("At most 8 verifiable facts and figures stated in the text"),
  searchQueries: z.array(z.string()).describe("At most 3 short English queries to find related recent news"),
});

export const contextLabelSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      sentiment: z.enum(["positive", "negative", "neutral"]),
      relevance: z.number().describe("0 to 1"),
      note: z.string().describe("Why it matters, max 20 words"),
    }),
  ),
});

const evidenceIds = z.array(z.string()).describe("Evidence ids supporting this, e.g. [\"N2\",\"P4.1\"]");

export const scorecardSchema = z.object({
  verdict: z.object({
    stance: z.enum(["bullish", "bearish", "neutral"]),
    conviction: z.number().describe("Integer 1 to 5"),
    oneLiner: z.string(),
  }),
  scores: z
    .array(
      z.object({
        dimension: z.enum(["fundamentals", "momentum", "sentiment", "valuation", "risk"]),
        score: z.number().describe("0 to 100. For risk: higher means riskier"),
        rationale: z.string(),
        evidence: evidenceIds,
      }),
    )
    .describe("Exactly 5 entries, one per dimension"),
  agreements: z.array(z.string()).describe("At most 5"),
  disagreements: z
    .array(
      z.object({
        topic: z.string(),
        bullView: z.string(),
        bearView: z.string(),
        betterSupported: z.enum(["bull", "bear", "even"]),
      }),
    )
    .describe("At most 5"),
  keyRisks: z.array(z.string()).describe("At most 5"),
  catalysts: z.array(z.object({ event: z.string(), timing: z.string().nullable() })).describe("At most 5"),
  dataGaps: z.array(z.string()).describe("At most 5"),
});

export const kpiSchema = z.object({
  kpis: z
    .array(
      z.object({
        metric: z.string(),
        value: z.string().describe("As printed, with unit and currency"),
        period: z.string(),
        change: z.string().nullable().describe("YoY / QoQ change if stated"),
        evidence: z.string().describe("The single chunk id it came from, e.g. P12.1"),
      }),
    )
    .describe("At most 12"),
});
