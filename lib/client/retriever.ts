// Hybrid retriever that runs entirely in the browser:
// BM25 (always available, no key needed) + Gemini embeddings (when configured), fused with
// Reciprocal Rank Fusion. Vectors live in memory for the session; nothing is stored server-side.

import { FULL_TEXT_CHAR_LIMIT } from "@/config/models";
import type { PdfChunk } from "@/lib/types";

// ---------------- BM25 ----------------

const CJK = /[㐀-鿿豈-﫿]/;

/** Latin words plus CJK character bigrams, so Chinese reports work without a segmenter. */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const m of text.toLowerCase().matchAll(/[a-z0-9][a-z0-9.%$-]*|[㐀-鿿豈-﫿]+/g)) {
    const w = m[0];
    if (CJK.test(w)) {
      if (w.length === 1) tokens.push(w);
      for (let i = 0; i < w.length - 1; i++) tokens.push(w.slice(i, i + 2));
    } else if (w.length > 1 && !STOP.has(w)) {
      tokens.push(w);
    }
  }
  return tokens;
}

const STOP = new Set("the of and to in a is for on that by with as at from be are was were this it its or an which have has".split(" "));

class Bm25 {
  private tf: Map<string, number>[] = [];
  private df = new Map<string, number>();
  private len: number[] = [];
  private avg = 0;

  constructor(docs: string[], private k1 = 1.4, private b = 0.75) {
    for (const d of docs) {
      const counts = new Map<string, number>();
      const toks = tokenize(d);
      for (const t of toks) counts.set(t, (counts.get(t) ?? 0) + 1);
      for (const t of counts.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.tf.push(counts);
      this.len.push(toks.length);
    }
    this.avg = this.len.reduce((a, b) => a + b, 0) / Math.max(docs.length, 1);
  }

  scores(query: string): number[] {
    const q = [...new Set(tokenize(query))];
    const N = this.tf.length;
    return this.tf.map((counts, i) => {
      let s = 0;
      for (const t of q) {
        const f = counts.get(t);
        if (!f) continue;
        const idf = Math.log(1 + (N - (this.df.get(t) ?? 0) + 0.5) / ((this.df.get(t) ?? 0) + 0.5));
        s += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * this.len[i]) / this.avg));
      }
      return s;
    });
  }
}

// ---------------- Index ----------------

export type EmbedFn = (texts: string[], task: "document" | "query") => Promise<number[][]>;

export class DocIndex {
  private bm25: Bm25;
  private vectors: number[][] | null = null;

  constructor(public readonly chunks: PdfChunk[]) {
    this.bm25 = new Bm25(chunks.map((c) => c.text));
  }

  get hasVectors() {
    return this.vectors !== null;
  }

  get totalChars() {
    return this.chunks.reduce((n, c) => n + c.text.length, 0);
  }

  /** Small documents skip retrieval and go to the model whole. */
  get fitsFullText() {
    return this.totalChars <= FULL_TEXT_CHAR_LIMIT;
  }

  async embed(embed: EmbedFn, onProgress?: (done: number, total: number) => void) {
    const out: number[][] = [];
    const BATCH = 100;
    for (let i = 0; i < this.chunks.length; i += BATCH) {
      const batch = this.chunks.slice(i, i + BATCH).map((c) => c.text);
      out.push(...(await embed(batch, "document")));
      onProgress?.(Math.min(i + BATCH, this.chunks.length), this.chunks.length);
    }
    this.vectors = out;
  }

  /** Rank chunks for each query and fuse all rankings with RRF. */
  async search(queries: string[], k: number, embed?: EmbedFn): Promise<PdfChunk[]> {
    const rankings: number[][] = queries.map((q) => argsortDesc(this.bm25.scores(q)));

    if (this.vectors && embed) {
      try {
        const qv = await embed(queries, "query");
        for (const v of qv) rankings.push(argsortDesc(this.vectors.map((d) => cosine(v, d))));
      } catch {
        // Fall back to lexical ranking only.
      }
    }

    const fused = new Map<number, number>();
    for (const ranking of rankings) {
      ranking.slice(0, 50).forEach((idx, rank) => fused.set(idx, (fused.get(idx) ?? 0) + 1 / (60 + rank)));
    }
    const ranked = [...fused.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([idx]) => this.chunks[idx]);
    // No lexical overlap and no vectors (e.g. a Chinese question on an English report without a
    // Gemini key): fall back to the opening chunks so the model can say the answer was not found.
    return ranked.length ? ranked : this.chunks.slice(0, k);
  }
}

/** Queries used to pull the parts of a report an analyst would read first. */
export const ANALYSIS_QUERIES = [
  "revenue net income profit growth year over year 收入 营业额 净利润 同比",
  "gross margin operating margin earnings per share dividend 毛利率 每股盈利 股息",
  "cash flow balance sheet debt liquidity capital expenditure 现金流 资产负债 负债 资本开支",
  "outlook guidance strategy priorities next year 展望 指引 战略",
  "risk factors uncertainties competition regulation 风险 不确定性 竞争 监管",
  "segment performance business units geographic 分部 业务 地区",
];

/**
 * Choose what the analysis run sees: the whole document when it fits,
 * otherwise the opening pages plus hybrid-retrieved chunks, restored to document order.
 */
export async function selectForAnalysis(index: DocIndex, embed?: EmbedFn): Promise<{ chunks: PdfChunk[]; retrieval: string }> {
  if (index.fitsFullText) return { chunks: index.chunks, retrieval: "full-text" };

  const opening = index.chunks.filter((c) => c.page <= 2).slice(0, 4);
  const retrieved = await index.search(ANALYSIS_QUERIES, 36, embed);
  const picked = new Map<string, PdfChunk>();
  [...opening, ...retrieved].forEach((c) => picked.set(c.id, c));
  const order = new Map(index.chunks.map((c, i) => [c.id, i]));
  const chunks = [...picked.values()].sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return { chunks, retrieval: `${index.hasVectors ? "hybrid" : "bm25"} top-${chunks.length}` };
}

function argsortDesc(xs: number[]) {
  return xs
    .map((v, i) => [v, i] as const)
    .filter(([v]) => v > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([, i]) => i);
}

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
