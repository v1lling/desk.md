import TurndownService from "turndown";
import { titleFromFilename } from "../index";
import type { ConversionResult } from "../types";

let cachedService: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (cachedService) return cachedService;
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
  });
  service.addRule("strikethrough", {
    filter: ["del", "s"],
    replacement: (text) => `~~${text}~~`,
  });
  service.addRule("table", {
    filter: "table",
    replacement: (_content, node) => htmlTableToMarkdown(node as HTMLElement),
  });
  cachedService = service;
  return service;
}

export function htmlToMarkdown(html: string): string {
  return getTurndown().turndown(html);
}

export async function convertHtml(
  filename: string,
  content: Uint8Array,
): Promise<ConversionResult> {
  const html = new TextDecoder("utf-8").decode(content);
  const markdown = htmlToMarkdown(html).trim();
  if (!markdown) {
    throw new Error("html-empty");
  }
  return {
    title: extractHtmlTitle(html) ?? titleFromFilename(filename),
    markdown,
  };
}

function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function htmlTableToMarkdown(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) return "";

  const cells = rows.map((row) =>
    Array.from(row.querySelectorAll("th,td")).map((cell) =>
      (cell.textContent ?? "").replace(/\s+/g, " ").replace(/\|/g, "\\|").trim(),
    ),
  );

  const colCount = Math.max(...cells.map((r) => r.length));
  const normalized = cells.map((r) => {
    const out = [...r];
    while (out.length < colCount) out.push("");
    return out;
  });

  const [headerRow, ...bodyRows] = normalized;
  const separator = Array(colCount).fill("---");
  const lines = [
    `| ${headerRow.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...bodyRows.map((r) => `| ${r.join(" | ")} |`),
  ];
  return `\n\n${lines.join("\n")}\n\n`;
}
