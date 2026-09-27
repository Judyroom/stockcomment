// The only module that reads provider API keys. Import it from server code only
// (API routes, lib/pipeline, eval scripts). Keys never reach the browser bundle because
// they are not NEXT_PUBLIC_ variables.

import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { EmbeddingModel, LanguageModel, generateText } from "ai";
import { EMBEDDING_DIMENSIONS, embeddingModelId, modelId, type Tier } from "@/config/models";
import type { Provider, ServerCapabilities } from "@/lib/types";

type ProviderOptions = Parameters<typeof generateText>[0]["providerOptions"];

export interface ModelCall {
  model: LanguageModel;
  modelId: string;
  providerOptions?: ProviderOptions;
  temperature?: number;
  maxRetries?: number;
}

const deepseekKey = () => process.env.DEEPSEEK_API_KEY?.trim();
const geminiKey = () => process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();

export function capabilities(): ServerCapabilities {
  const gemini = Boolean(geminiKey());
  return {
    providers: { deepseek: Boolean(deepseekKey()), gemini },
    // Google News RSS is always available as the last web-research fallback.
    webSearch: true,
    embeddings: gemini,
    accessCodeRequired: Boolean(process.env.ACCESS_CODE?.trim()),
  };
}

export class ProviderUnavailableError extends Error {
  constructor(provider: string) {
    super(`${provider} is not configured on the server (missing API key).`);
  }
}

const deepseek = () => {
  const apiKey = deepseekKey();
  if (!apiKey) throw new ProviderUnavailableError("DeepSeek");
  return createDeepSeek({ apiKey });
};

const google = () => {
  const apiKey = geminiKey();
  if (!apiKey) throw new ProviderUnavailableError("Gemini");
  return createGoogleGenerativeAI({ apiKey });
};

/**
 * Resolve a model for a job.
 * - `fast`: extraction, labelling, structured output. Thinking off where possible.
 * - `main`: analyst writing. `deep` swaps in the stronger model with visible reasoning.
 * `structured` forces thinking off on DeepSeek, whose JSON mode is most reliable without it.
 */
export function getModel(
  provider: Provider,
  tier: Tier,
  opts: { temperature?: number; structured?: boolean } = {},
): ModelCall {
  const id = modelId(provider, tier);
  const thinking = tier === "deep" && !opts.structured;

  if (provider === "deepseek") {
    return {
      model: deepseek()(id),
      modelId: id,
      providerOptions: {
        deepseek: thinking
          ? { thinking: { type: "enabled" }, reasoningEffort: "high" }
          : { thinking: { type: "disabled" } },
      },
      // DeepSeek ignores temperature while thinking, so only send it when thinking is off.
      temperature: thinking ? undefined : opts.temperature,
    };
  }

  return {
    model: google()(id),
    modelId: id,
    providerOptions: {
      google: {
        thinkingConfig: thinking
          ? { thinkingLevel: "high", includeThoughts: true }
          : { thinkingLevel: "low" },
      },
    },
    // Gemini 3+ is tuned for its default temperature; overriding it tends to hurt quality.
    // Free-tier keys hit per-minute limits quickly; repeated retries only burn more quota.
    maxRetries: 1,
  };
}

/** Gemini with Google Search grounding, used for the optional web-research stage. */
export function getSearchModel() {
  const g = google();
  const id = modelId("gemini", "fast");
  return { model: g(id), modelId: id, tools: { google_search: g.tools.googleSearch({}) } };
}

export function getEmbeddingModel(task: "document" | "query"): {
  model: EmbeddingModel;
  providerOptions: ProviderOptions;
} {
  return {
    model: google().embedding(embeddingModelId()),
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: task === "document" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY",
      },
    },
  };
}
