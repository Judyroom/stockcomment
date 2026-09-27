// Browser-side PDF parsing. Parsing in the browser keeps large reports off the
// serverless request-size limit (~4.5 MB on Vercel); only selected text goes to the server.

import type { PdfChunk } from "@/lib/types";

const CHUNK_CHARS = 1400;
const OVERLAP_CHARS = 200;

export interface ParsedPdf {
  fileName: string;
  pageCount: number;
  chunks: PdfChunk[];
  totalChars: number;
}

export async function parsePdf(file: File, onProgress?: (page: number, total: number) => void): Promise<ParsedPdf> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const chunks: PdfChunk[] = [];
  let totalChars = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : " ");
    }
    text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    totalChars += text.length;
    splitPage(text, p).forEach((c) => chunks.push(c));
    onProgress?.(p, doc.numPages);
  }
  const pageCount = doc.numPages;
  await task.destroy();
  return { fileName: file.name, pageCount, chunks, totalChars };
}

/** Split one page into overlapping chunks, preferring paragraph and sentence boundaries. Ids look like P12.1. */
function splitPage(text: string, page: number): PdfChunk[] {
  if (text.length < 40) return [];
  const out: PdfChunk[] = [];
  let start = 0;
  let n = 1;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_CHARS, text.length);
    if (end < text.length) {
      const window = text.slice(start + CHUNK_CHARS * 0.6, end);
      const cut = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(". "), window.lastIndexOf("。"));
      if (cut > 0) end = start + CHUNK_CHARS * 0.6 + cut + 1;
    }
    out.push({ id: `P${page}.${n++}`, page, text: text.slice(start, end).trim() });
    if (end >= text.length) break;
    start = Math.max(end - OVERLAP_CHARS, start + 1);
  }
  return out;
}
