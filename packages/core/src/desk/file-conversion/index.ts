import { getExtension } from "../file-utils";
import type { ConversionResult, ConvertibleKind } from "./types";

export type { ConversionResult, ConvertibleKind } from "./types";

const EXT_TO_KIND: Record<string, ConvertibleKind> = {
  docx: "docx",
  pdf: "pdf",
  html: "html",
  htm: "html",
  csv: "csv",
  xlsx: "xlsx",
  xls: "xlsx",
  rtf: "rtf",
  txt: "txt",
};

function getConvertibleKind(filename: string): ConvertibleKind | null {
  const ext = getExtension(filename);
  if (!ext) return null;
  return EXT_TO_KIND[ext] ?? null;
}

export function titleFromFilename(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  const base = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  return base.trim() || filename;
}

export async function convertFileToMarkdown(
  filename: string,
  content: Uint8Array,
): Promise<ConversionResult> {
  const kind = getConvertibleKind(filename);
  if (!kind) {
    throw new Error(`Not a convertible file: ${filename}`);
  }

  switch (kind) {
    case "docx": {
      const { convertDocx } = await import("./converters/docx");
      return convertDocx(filename, content);
    }
    case "pdf": {
      const { convertPdf } = await import("./converters/pdf");
      return convertPdf(filename, content);
    }
    case "html": {
      const { convertHtml } = await import("./converters/html");
      return convertHtml(filename, content);
    }
    case "csv": {
      const { convertCsv } = await import("./converters/csv");
      return convertCsv(filename, content);
    }
    case "xlsx": {
      const { convertXlsx } = await import("./converters/xlsx");
      return convertXlsx(filename, content);
    }
    case "rtf":
    case "txt": {
      const { convertText } = await import("./converters/text");
      return convertText(filename, content, kind);
    }
  }
}
