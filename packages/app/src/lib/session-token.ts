/**
 * Native hosted-mode session token store (step 3b-native).
 *
 * The native client authenticates to a remote desk.md server with Better Auth's
 * bearer plugin: sign-in returns the session token in the `set-auth-token` header,
 * which we persist in the OS Keychain (via the existing `secret_*` Tauri commands)
 * and send back as `Authorization: Bearer <token>`. The web/PWA tier uses a cookie
 * instead and never touches this module.
 *
 * A synchronous in-memory mirror (`cachedToken`) backs `getTokenHeaderSync()` so the
 * RemoteDeskService transport and the Better Auth client can attach the header without
 * awaiting a Keychain read on every request. Call `loadSessionToken()` once at boot
 * (and after sign-in) to populate it.
 */
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@desk/core";

const SECRET_SERVICE = "desk.session.token";

interface SecretGetResponse {
  value: string | null;
}

let cachedToken: string | null = null;

/**
 * Read the token from the Keychain into the in-memory mirror. Returns the token (or
 * null). No-op returning null outside Tauri. Errors are swallowed to null — a missing
 * or unreadable token simply means "not signed in", which the auth gate handles.
 */
export async function loadSessionToken(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }
  try {
    const result = await invoke<SecretGetResponse>("secret_get", { service: SECRET_SERVICE });
    cachedToken = result.value?.trim() ? result.value : null;
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

/** Persist a new token to the Keychain and update the in-memory mirror. */
export async function setSessionToken(token: string): Promise<void> {
  cachedToken = token;
  if (isTauri()) {
    await invoke("secret_set", { service: SECRET_SERVICE, value: token });
  }
}

/** Clear the token from the Keychain and the in-memory mirror (sign-out / switch to local). */
export async function clearSessionToken(): Promise<void> {
  cachedToken = null;
  if (isTauri()) {
    try {
      await invoke("secret_delete", { service: SECRET_SERVICE });
    } catch {
      // Deleting a non-existent key throws on some keychains; harmless.
    }
  }
}

/** The current token from the in-memory mirror (populated by loadSessionToken). */
export function getSessionTokenSync(): string | null {
  return cachedToken;
}

/** `Bearer <token>` for the current token, or null when unauthenticated. */
export function getTokenHeaderSync(): string | null {
  return cachedToken ? `Bearer ${cachedToken}` : null;
}
