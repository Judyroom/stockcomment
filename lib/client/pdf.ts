// Browser-side PDF parsing. Parsing in the browser keeps large reports off the
// serverless request-size limit (~4.5 MB on Vercel); only selected text goes to the server.

import { parsePdfData, type ParsedPdf } from "@/lib/pdf-core";

export type { ParsedPdf };

export async function parsePdf(file: File, onProgress?: (page: number, total: number) => void): Promise<ParsedPdf> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return parsePdfData(pdfjs, new Uint8Array(await file.arrayBuffer()), file.name, onProgress);
}
