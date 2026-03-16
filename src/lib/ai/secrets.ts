import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/desk/tauri-fs";

export type SecretKeyRef =
  | "ai.openai"
  | "ai.anthropic";

const SECRET_SERVICE: Record<SecretKeyRef, string> = {
  "ai.openai": "desk.ai.openai",
  "ai.anthropic": "desk.ai.anthropic",
};

const FALLBACK_PREFIX = "desk.secret.";

interface SecretGetResponse {
  value: string | null;
}

export async function getSecret(key: SecretKeyRef): Promise<string | null> {
  const service = SECRET_SERVICE[key];

  if (!isTauri()) {
    return localStorage.getItem(`${FALLBACK_PREFIX}${service}`);
  }

  try {
    const result = await invoke<SecretGetResponse>("secret_get", { service });
    return result.value ?? null;
  } catch (error) {
    console.warn(`[secrets] Failed to read key '${service}':`, error);
    return null;
  }
}

export async function setSecret(key: SecretKeyRef, value: string): Promise<void> {
  const service = SECRET_SERVICE[key];

  if (!isTauri()) {
    localStorage.setItem(`${FALLBACK_PREFIX}${service}`, value);
    return;
  }

  await invoke("secret_set", { service, value });
}

export async function deleteSecret(key: SecretKeyRef): Promise<void> {
  const service = SECRET_SERVICE[key];

  if (!isTauri()) {
    localStorage.removeItem(`${FALLBACK_PREFIX}${service}`);
    return;
  }

  await invoke("secret_delete", { service });
}

export async function hasSecret(key: SecretKeyRef): Promise<boolean> {
  const value = await getSecret(key);
  return !!value?.trim();
}
