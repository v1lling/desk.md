import { titleFromFilename } from "../index";
import type { ConversionResult, ConvertibleKind } from "../types";

export async function convertText(
  filename: string,
  content: Uint8Array,
  kind: ConvertibleKind,
): Promise<ConversionResult> {
  const text = new TextDecoder("utf-8").decode(content);
  const body = kind === "rtf" ? stripRtf(text) : text;
  const markdown = body.trim();
  if (!markdown) {
    throw new Error(`${kind}-empty`);
  }
  return {
    title: titleFromFilename(filename),
    markdown,
  };
}

function stripRtf(rtf: string): string {
  let out = rtf.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  out = out.replace(/\\par[d]?\b/g, "\n");
  out = out.replace(/\\line\b/g, "\n");
  out = out.replace(/\\tab\b/g, "\t");
  out = out.replace(/\{\\\*[^{}]*\}/g, "");
  out = out.replace(/\\[a-zA-Z]+-?\d*\s?/g, "");
  out = out.replace(/[{}]/g, "");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}
