// Thin browser client for the API routes.

import type { AnalyzeRequest } from "@/lib/schemas";
import type { Lang, PdfChunk, Provider, ServerCapabilities, StreamEvent } from "@/lib/types";
import type { NewsItem } from "@/lib/tools/news";
import type { EmbedFn } from "./retriever";

const CODE_KEY = "sc.accessCode";

export const accessCode = {
  get: () => {
    try {
      return localStorage.getItem(CODE_KEY) ?? "";
    } catch {
      return "";
    }
  },
  set: (v: string) => {
    try {
      localStorage.setItem(CODE_KEY, v);
    } catch {}
  },
};

export class ApiError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

const headers = () => ({ "Content-Type": "application/json", "x-access-code": accessCode.get() });

async function post(path: string, body: unknown, signal?: AbortSignal) {
  const res = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body), signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error ?? `http_${res.status}`, data.message);
  }
  return res;
}

export async function fetchCapabilities(): Promise<ServerCapabilities> {
  const res = await fetch("/api/config", { cache: "no-store" });
  return res.json();
}

export const embed: EmbedFn = async (texts, task) => {
  const res = await post("/api/embed", { texts, task });
  return (await res.json()).embeddings;
};

export async function searchNews(query: string): Promise<NewsItem[]> {
  const res = await post("/api/news-search", { query });
  return (await res.json()).items;
}

export async function streamAnalyze(req: AnalyzeRequest, onEvent: (e: StreamEvent) => void, signal?: AbortSignal) {
  const res = await post("/api/analyze", req, signal);
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as StreamEvent);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as StreamEvent);
}

export async function streamAsk(
  body: {
    lang: Lang;
    provider: Provider;
    question: string;
    fileName: string;
    chunks: PdfChunk[];
    history: { role: "user" | "assistant"; content: string }[];
  },
  onText: (t: string) => void,
  signal?: AbortSignal,
) {
  const res = await post("/api/ask", body, signal);
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    onText(value);
  }
}
