// Folds the NDJSON event stream into renderable state.

import type {
  AgentInfo,
  Evidence,
  Extraction,
  Kpi,
  Quote,
  RunMeta,
  Scorecard,
  StageId,
  StageStatus,
  StreamEvent,
} from "@/lib/types";

export interface AgentState {
  info: AgentInfo;
  text: string;
  reasoning: string;
  status: "streaming" | "done" | "error";
  error?: string;
}

export interface RunState {
  id: string;
  createdAt: number;
  title: string;
  inputKind: "text" | "pdf";
  mode: "single" | "debate";
  status: "running" | "done" | "error";
  stages: Partial<Record<StageId, { status: StageStatus; detail?: string }>>;
  extraction?: Extraction;
  quotes: Quote[];
  evidence: Evidence[];
  agents: AgentState[];
  kpis?: Kpi[];
  scorecard?: Scorecard;
  meta?: RunMeta;
  error?: string;
  /** Set when the run is a built-in demo loaded from public/demos (no API calls). */
  demo?: {
    id: string;
    lang: "en" | "zh";
    generatedAt: string;
    provider: string;
    newsFrom: string | null;
    newsTo: string | null;
    /** PDF demos: the public document the result was generated from. */
    source?: { title: string; publisher: string; url: string };
  };
}

export function newRun(title: string, inputKind: RunState["inputKind"], mode: RunState["mode"]): RunState {
  return {
    id: Math.random().toString(36).slice(2, 10),
    createdAt: Date.now(),
    title,
    inputKind,
    mode,
    status: "running",
    stages: {},
    quotes: [],
    evidence: [],
    agents: [],
  };
}

export function reduce(state: RunState, e: StreamEvent): RunState {
  switch (e.type) {
    case "stage":
      return { ...state, stages: { ...state.stages, [e.stage]: { status: e.status, detail: e.detail } } };
    case "extraction":
      return { ...state, extraction: e.data, title: e.data.headline || state.title };
    case "quotes":
      return { ...state, quotes: e.data };
    case "evidence":
      return { ...state, evidence: e.data };
    case "agent-start":
      return {
        ...state,
        agents: [...state.agents.filter((a) => a.info.id !== e.agent.id), { info: e.agent, text: "", reasoning: "", status: "streaming" }],
      };
    case "agent-delta":
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.info.id !== e.agentId
            ? a
            : e.channel === "text"
              ? { ...a, text: a.text + e.text }
              : { ...a, reasoning: a.reasoning + e.text },
        ),
      };
    case "agent-end":
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.info.id === e.agentId ? { ...a, status: e.error ? "error" : "done", error: e.error } : a,
        ),
      };
    case "kpis":
      return { ...state, kpis: e.data };
    case "scorecard":
      return { ...state, scorecard: e.data };
    case "error":
      return { ...state, status: "error", error: e.message };
    case "done":
      return { ...state, status: state.status === "error" ? "error" : "done", meta: e.meta };
  }
}
