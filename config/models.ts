// Model registry. Every id can be overridden with an env var, so a new model
// release is a config change, not a code change.

import type { Provider } from "@/lib/types";

export type Tier = "fast" | "main" | "deep";

const env = (key: string, fallback: string) => process.env[key]?.trim() || fallback;

export function modelId(provider: Provider, tier: Tier): string {
  if (provider === "deepseek") {
    return {
      fast: env("DEEPSEEK_FAST_MODEL", "deepseek-v4-flash"),
      main: env("DEEPSEEK_MAIN_MODEL", "deepseek-v4-flash"),
      deep: env("DEEPSEEK_DEEP_MODEL", "deepseek-v4-pro"),
    }[tier];
  }
  return {
    fast: env("GEMINI_FAST_MODEL", "gemini-flash-latest"),
    main: env("GEMINI_MAIN_MODEL", "gemini-flash-latest"),
    deep: env("GEMINI_DEEP_MODEL", "gemini-pro-latest"),
  }[tier];
}

export const embeddingModelId = () => env("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001");
export const EMBEDDING_DIMENSIONS = 768;

/** Documents at or under this many characters are sent whole instead of retrieved. */
export const FULL_TEXT_CHAR_LIMIT = 120_000;
