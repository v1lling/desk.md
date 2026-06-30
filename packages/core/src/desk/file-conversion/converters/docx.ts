import mammoth from "mammoth";
import { titleFromFilename } from "../index";
import { htmlToMarkdown } from "./html";
import type { ConversionResult } from "../types";

export async function convertDocx(
  filename: string,
  content: Uint8Array,
): Promise<ConversionResult> {
  const result = await mammoth.convertToHtml(
    { arrayBuffer: toArrayBuffer(content) },
    {
      convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: "" })),
    },
  );

  const markdown = htmlToMarkdown(result.value).trim();
  if (!markdown) {
    throw new Error("docx-empty");
  }

  const warnings: string[] = [];
  const imageCount = result.messages.filter((m) => m.type === "warning" && /image/i.test(m.message)).length;
  if (imageCount > 0) {
    warnings.push(`Skipped ${imageCount} embedded image${imageCount === 1 ? "" : "s"}`);
  }

  return {
    title: titleFromFilename(filename),
    markdown,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer;
  }
  return bytes.slice().buffer;
}
