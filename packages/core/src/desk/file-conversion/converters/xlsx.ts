import readXlsxFile from "read-excel-file/browser";
import { titleFromFilename } from "../index";
import { rowsToMarkdownTable } from "./table-utils";
import type { ConversionResult } from "../types";

export async function convertXlsx(
  filename: string,
  content: Uint8Array,
): Promise<ConversionResult> {
  const buffer = toArrayBuffer(content);
  const sheets = await readXlsxFile(buffer);
  const sections: string[] = [];

  for (const { sheet, data } of sheets) {
    const cellRows = data.map((row) => row.map(formatCell));
    if (cellRows.some((row) => row.some((c) => c.length > 0))) {
      sections.push(`## ${sheet}\n\n${rowsToMarkdownTable(cellRows)}`);
    }
  }

  if (sections.length === 0) throw new Error("xlsx-empty");

  return {
    title: titleFromFilename(filename),
    markdown: sections.join("\n\n"),
  };
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  return bytes.slice().buffer;
}
