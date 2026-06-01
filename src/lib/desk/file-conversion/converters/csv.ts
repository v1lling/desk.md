import Papa from "papaparse";
import { titleFromFilename } from "../index";
import { rowsToMarkdownTable } from "./table-utils";
import type { ConversionResult } from "../types";

export async function convertCsv(
  filename: string,
  content: Uint8Array,
): Promise<ConversionResult> {
  const text = new TextDecoder("utf-8").decode(content);
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const rows = parsed.data.filter((r): r is string[] => Array.isArray(r));

  if (rows.length === 0) {
    throw new Error("csv-empty");
  }

  return {
    title: titleFromFilename(filename),
    markdown: rowsToMarkdownTable(rows),
  };
}
