/**
 * RPC transport codec for the DeskService HTTP boundary (SEAM 2, step 3).
 *
 * The DeskService contract is JSON-clean except for ONE wire-hostile type:
 * `Uint8Array`, carried in `importFiles(files)` (raw bytes of dropped files).
 * Plain `JSON.stringify` turns a Uint8Array into `{"0":..,"1":..}` — lossy and
 * huge — so this codec round-trips it as `{ "$u8": "<base64>" }` instead.
 *
 * Returns are plain POJOs (Doc/Task/…), so the response path needs no special
 * handling, but both the request and response use this codec for symmetry: the
 * client encodes `{ args }`, the server decodes it, runs the op, and encodes
 * `{ result }` back.
 *
 * This module is pure (no domain imports) so the web client can bundle it
 * without pulling the whole `@desk/core` domain into the browser.
 */
import { Buffer } from "buffer";

const U8_TAG = "$u8";

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** Serialize any DeskService arg/return value, encoding Uint8Array as base64. */
export function encode(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v instanceof Uint8Array ? { [U8_TAG]: bytesToBase64(v) } : v
  );
}

/** Parse a codec-encoded payload, reviving `{ $u8 }` wrappers back to Uint8Array. */
export function decode<T = unknown>(text: string): T {
  return JSON.parse(text, (_key, v) => {
    if (
      v &&
      typeof v === "object" &&
      typeof (v as Record<string, unknown>)[U8_TAG] === "string"
    ) {
      return base64ToBytes((v as Record<string, string>)[U8_TAG]);
    }
    return v;
  }) as T;
}
