/**
 * Native hosted-mode Better Auth client (step 3b-native).
 *
 * Unlike the web client ([auth-client.ts]), which is same-origin and cookie-based,
 * this client talks to a user-chosen remote server and authenticates with a bearer
 * token (Better Auth's bearer plugin):
 *   - `baseURL`         → the configured server URL (runtime, from the boot store),
 *                         so the client is created per-connection, not at module load.
 *   - `customFetchImpl` → the Tauri HTTP plugin (Rust reqwest) → bypasses webview CSP
 *                         + CORS, and exposes the `set-auth-token` response header
 *                         (a browser would hide it without Access-Control-Expose-Headers).
 *   - `auth`            → attaches `Authorization: Bearer <token>` from the in-memory
 *                         Keychain mirror on every request.
 *   - `onSuccess`       → captures a fresh `set-auth-token` (sign-in / sign-up) into the
 *                         Keychain so the session survives a restart.
 *
 * Gated for bundling behind `!VITE_DESK_HOSTED` and only constructed inside a Tauri
 * webview (isTauri()), so the lean web/PWA build never pulls better-auth in through here.
 */
import { createAuthClient } from "better-auth/react";
import { nativeFetch } from "./native-http";
import { getSessionTokenSync, setSessionToken } from "./session-token";

export function createNativeAuthClient(serverUrl: string) {
  return createAuthClient({
    baseURL: serverUrl.replace(/\/$/, ""),
    fetchOptions: {
      customFetchImpl: nativeFetch,
      auth: {
        type: "Bearer",
        // Empty string → better-fetch omits the header (treated as unauthenticated).
        token: () => getSessionTokenSync() ?? "",
      },
      onSuccess: async (ctx) => {
        const token = ctx.response.headers.get("set-auth-token");
        if (token) {
          await setSessionToken(token);
        }
      },
    },
  });
}

export type NativeAuthClient = ReturnType<typeof createNativeAuthClient>;
