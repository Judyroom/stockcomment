// Loads built-in demo results from public/demos. No API calls, no tokens.

import { newsDateRange, type DemoFile, type DemoManifest } from "@/config/demos";
import type { Lang } from "@/lib/types";
import type { RunState } from "./run-state";

export interface LoadedDemo extends Omit<DemoFile, "run"> {
  run: RunState;
}

/** "2026-09-22 – 2026-09-27", or a single date when both ends match. */
export function formatRange(from: string | null | undefined, to: string | null | undefined) {
  if (!from && !to) return "—";
  return from === to || !to ? String(from) : `${from} – ${to}`;
}

export async function loadDemoManifest(): Promise<DemoManifest | null> {
  try {
    const res = await fetch("/demos/manifest.json");
    return res.ok ? ((await res.json()) as DemoManifest) : null;
  } catch {
    return null;
  }
}

export async function loadDemo(id: string, lang: Lang): Promise<LoadedDemo> {
  for (const l of [lang, lang === "zh" ? "en" : "zh"] as const) {
    const res = await fetch(`/demos/${id}.${l}.json`);
    if (!res.ok) continue;
    const file = (await res.json()) as DemoFile;
    const run = file.run as RunState;
    return {
      ...file,
      // Record the requested language, not the file's, so a fallback file does not trigger reloads.
      run: {
        ...run,
        demo: {
          id: file.id,
          lang,
          generatedAt: file.generatedAt,
          provider: file.provider,
          ...newsDateRange(file.inputText),
          source: file.pdf ? { title: file.pdf.docTitle, publisher: file.pdf.publisher, url: file.pdf.sourceUrl } : undefined,
        },
      },
    };
  }
  throw new Error(`Demo "${id}" has not been generated yet. Run npm run demos.`);
}
