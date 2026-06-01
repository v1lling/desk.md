import { titleFromFilename } from "../index";
import type { ConversionResult } from "../types";

interface TextItem {
  str: string;
  hasEOL?: boolean;
}

let workerInitialized = false;

async function initWorker(pdfjs: typeof import("pdfjs-dist")): Promise<void> {
  if (workerInitialized) return;
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  workerInitialized = true;
}

export async function convertPdf(
  filename: string,
  content: Uint8Array,
): Promise<ConversionResult> {
  const pdfjs = await import("pdfjs-dist");
  await initWorker(pdfjs);

  const loadingTask = pdfjs.getDocument({ data: content });
  const doc = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const text = await page.getTextContent();
    const lines = textItemsToLines(text.items as TextItem[]);
    if (lines.length > 0) {
      pageTexts.push(lines.join("\n"));
    }
    page.cleanup();
  }
  await loadingTask.destroy();

  const markdown = pageTexts.join("\n\n").trim();
  if (!markdown) {
    throw new Error("pdf-empty");
  }

  return {
    title: titleFromFilename(filename),
    markdown,
  };
}

function textItemsToLines(items: TextItem[]): string[] {
  const lines: string[] = [];
  let current = "";
  for (const item of items) {
    if (!item || typeof item.str !== "string") continue;
    current += item.str;
    if (item.hasEOL) {
      const trimmed = current.replace(/\s+$/, "");
      if (trimmed) lines.push(trimmed);
      current = "";
    } else if (item.str && !item.str.endsWith(" ")) {
      current += " ";
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}
