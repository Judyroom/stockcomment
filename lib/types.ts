// Types shared by the browser and the server. Nothing in here may touch secrets.

export type Lang = "en" | "zh";
export type Provider = "deepseek" | "gemini";
export type Stance = "bullish" | "bearish" | "neutral";
export type Strength = "strong" | "moderate" | "mild";
export type Sentiment = "positive" | "negative" | "neutral";

export type EvidenceKind = "input" | "news" | "web" | "pdf";

/** One citable piece of evidence. Analysts cite it as [id], e.g. [N2] or [P12.1]. */
export interface Evidence {
  id: string;
  kind: EvidenceKind;
  title: string;
  source?: string;
  url?: string;
  page?: number;
  publishedAt?: string;
  text?: string;
  sentiment?: Sentiment;
  relevance?: number;
  note?: string;
}

export interface PricePoint {
  t: number;
  c: number;
}

export interface Quote {
  symbol: string;
  name: string;
  price: number | null;
  currency: string | null;
  changePct: number | null;
  ytdPct: number | null;
  marketCap: number | null;
  pe: number | null;
  high52: number | null;
  low52: number | null;
  exchange: string | null;
  history: PricePoint[];
}

export interface Entity {
  name: string;
  ticker: string | null;
  type: "company" | "index" | "sector" | "macro" | "person" | "other";
  role: "subject" | "mentioned";
  confidence: number;
}

export interface Extraction {
  headline: string;
  summary: string;
  eventType: string;
  entities: Entity[];
  keyFacts: string[];
  searchQueries: string[];
}

export type AgentRole = "analyst" | "rebuttal" | "document";

export interface AgentInfo {
  id: string;
  role: AgentRole;
  stance: Stance | null;
  personaId: string | null;
  title: string;
}

export interface ScoreItem {
  dimension: "fundamentals" | "momentum" | "sentiment" | "valuation" | "risk";
  score: number;
  rationale: string;
  evidence: string[];
}

export interface Scorecard {
  verdict: {
    stance: Stance;
    conviction: number;
    oneLiner: string;
  };
  scores: ScoreItem[];
  agreements: string[];
  disagreements: {
    topic: string;
    bullView: string;
    bearView: string;
    betterSupported: "bull" | "bear" | "even";
  }[];
  keyRisks: string[];
  catalysts: { event: string; timing: string | null }[];
  dataGaps: string[];
}

export interface Kpi {
  metric: string;
  value: string;
  period: string;
  change: string | null;
  evidence: string;
}

export interface PdfChunk {
  id: string;
  page: number;
  text: string;
}

export type StageId =
  | "extract"
  | "market"
  | "news"
  | "web"
  | "context"
  | "analysts"
  | "rebuttal"
  | "kpis"
  | "pm";

export type StageStatus = "running" | "done" | "skipped" | "error";

export interface RunMeta {
  ms: number;
  provider: Provider;
  models: Record<string, string>;
  retrieval?: string;
}

/** Events streamed from /api/analyze as NDJSON, one per line. */
export type StreamEvent =
  | { type: "stage"; stage: StageId; status: StageStatus; detail?: string }
  | { type: "extraction"; data: Extraction }
  | { type: "quotes"; data: Quote[] }
  | { type: "evidence"; data: Evidence[] }
  | { type: "agent-start"; agent: AgentInfo }
  | { type: "agent-delta"; agentId: string; channel: "text" | "reasoning"; text: string }
  | { type: "agent-end"; agentId: string; error?: string }
  | { type: "kpis"; data: Kpi[] }
  | { type: "scorecard"; data: Scorecard }
  | { type: "error"; message: string }
  | { type: "done"; meta: RunMeta };

export interface ServerCapabilities {
  providers: Record<Provider, boolean>;
  webSearch: boolean;
  embeddings: boolean;
  accessCodeRequired: boolean;
}
