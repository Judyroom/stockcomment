"use client";

import { useCallback, useRef, useState } from "react";
import { embed } from "./api";
import { parsePdf, type ParsedPdf } from "./pdf";
import { DocIndex } from "./retriever";

export type PdfPhase =
  | { kind: "empty" }
  | { kind: "parsing"; page: number; total: number }
  | { kind: "ready"; embedding: { done: number; total: number } | "ready" | "off" | "error" }
  | { kind: "error"; message: string };

export function usePdf(embeddingsAvailable: boolean) {
  const [phase, setPhase] = useState<PdfPhase>({ kind: "empty" });
  const [doc, setDoc] = useState<ParsedPdf | null>(null);
  const [index, setIndex] = useState<DocIndex | null>(null);
  const token = useRef(0);

  const load = useCallback(
    async (file: File) => {
      const my = ++token.current;
      setDoc(null);
      setIndex(null);
      setPhase({ kind: "parsing", page: 0, total: 0 });
      try {
        const parsed = await parsePdf(file, (page, total) => my === token.current && setPhase({ kind: "parsing", page, total }));
        if (my !== token.current) return;
        if (!parsed.chunks.length) throw new Error("No extractable text (scanned PDF?)");
        const index = new DocIndex(parsed.chunks);
        setIndex(index);
        setDoc(parsed);

        // Embeddings are only needed when the document is too long to send whole.
        if (index.fitsFullText || !embeddingsAvailable) {
          setPhase({ kind: "ready", embedding: "off" });
          return;
        }
        setPhase({ kind: "ready", embedding: { done: 0, total: parsed.chunks.length } });
        try {
          await index.embed(embed, (done, total) => my === token.current && setPhase({ kind: "ready", embedding: { done, total } }));
          if (my === token.current) setPhase({ kind: "ready", embedding: "ready" });
        } catch {
          if (my === token.current) setPhase({ kind: "ready", embedding: "error" });
        }
      } catch (err) {
        if (my === token.current) setPhase({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      }
    },
    [embeddingsAvailable],
  );

  const clear = useCallback(() => {
    token.current++;
    setIndex(null);
    setDoc(null);
    setPhase({ kind: "empty" });
  }, []);

  return { phase, doc, index, load, clear };
}
