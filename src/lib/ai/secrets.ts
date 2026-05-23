import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/desk/tauri-fs";

export type SecretKeyRef =
  | "ai.openai"
  | "ai.anthropic";

const SECRET_SERVICE: Record<SecretKeyRef, string> = {
  "ai.openai": "desk.ai.openai",
  "ai.anthropic": "desk.ai.anthropic",
};

interface SecretGetResponse {
  value: string | null;
}

/**
 * Thrown when a secret operation is attempted outside Tauri.
 * Browser/dev mode has no OS keychain — AI features are off by design there.
 */
export class BrowserModeError extends Error {
  constructor() {
    super("AI key storage is unavailable in browser mode. Run `npm run tauri:dev` to test AI features.");
    this.name = "BrowserModeError";
  }
}

/**
 * Read a secret from the OS keychain.
 * Returns `null` when no key is stored. Throws `BrowserModeError` outside Tauri,
 * or a generic `Error` if the keychain itself fails (locked, unavailable, etc.).
 */
export async function getSecret(key: SecretKeyRef): Promise<string | null> {
  if (!isTauri()) {
    throw new BrowserModeError();
  }
  const service = SECRET_SERVICE[key];
  const result = await invoke<SecretGetResponse>("secret_get", { service });
  return result.value ?? null;
}

/**
 * Write a secret to the OS keychain. Throws `BrowserModeError` outside Tauri.
 */
export async function setSecret(key: SecretKeyRef, value: string): Promise<void> {
  if (!isTauri()) {
    throw new BrowserModeError();
  }
  const service = SECRET_SERVICE[key];
  await invoke("secret_set", { service, value });
}

/**
 * Delete a secret from the OS keychain. Throws `BrowserModeError` outside Tauri.
 */
export async function deleteSecret(key: SecretKeyRef): Promise<void> {
  if (!isTauri()) {
    throw new BrowserModeError();
  }
  const service = SECRET_SERVICE[key];
  await invoke("secret_delete", { service });
}

/**
 * Returns true if the key is present and non-empty.
 * Returns false on any error (including browser mode) — callers that need to
 * distinguish "no key" from "keychain failed" should call `getSecret` directly.
 */
export async function hasSecret(key: SecretKeyRef): Promise<boolean> {
  try {
    const value = await getSecret(key);
    return !!value?.trim();
  } catch {
    return false;
  }
}
