/**
 * RemoteDeskService — SEAM 2 client (step 3a).
 *
 * A thin fetch client implementing the full DeskService contract by POSTing each
 * method call to the server's `/api/desk/:op` RPC endpoint, where the same domain
 * runs in-process on NodeFsProvider. Injected via setDeskService() when the app
 * boots in hosted mode (see main.tsx); after that, every getDeskService() caller
 * (all 6 stores, behind React Query) transparently targets the server.
 *
 * A single Proxy covers all ~57 methods — there is no per-method code, so the
 * client can't drift from the interface. Bodies use the @desk/core rpc-codec
 * (base64 for the one Uint8Array arg in importFiles); errors thrown here surface
 * through React Query unchanged.
 */
import { encode, decode, AIProviderError, type AIErrorCode } from "@desk/core";
import type { DeskService, AIProviderType } from "@desk/core";

// Compile-time invariant: every DeskService method must return a Promise. The
// Proxy below always wraps calls in a Promise, so a synchronous method would
// behave differently here (remote) than in LocalDeskService. If this line fails
// to compile, a non-async method was added to DeskService — fix the interface.
type NonAsyncMethods<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => Promise<unknown> ? never : K;
}[keyof T];
const _allDeskServiceMethodsAreAsync: NonAsyncMethods<DeskService> extends never
  ? true
  : never = true;
void _allDeskServiceMethodsAreAsync;

/**
 * Transport options. Defaults (web/PWA, same-origin) use the browser `fetch` with
 * `credentials: "include"` to carry the session cookie. The native client (step
 * 3b-native) is cross-origin and cookie-less: it passes `fetchImpl` from
 * `@tauri-apps/plugin-http` (Rust reqwest — bypasses webview CSP + CORS) and
 * `authHeader` returning `Bearer <token>` from the Keychain.
 */
export interface RemoteDeskServiceOptions {
  fetchImpl?: typeof fetch;
  authHeader?: () => string | null;
}

export function createRemoteDeskService(
  baseUrl: string,
  opts: RemoteDeskServiceOptions = {}
): DeskService {
  const base = baseUrl.replace(/\/$/, "");
  const doFetch = opts.fetchImpl ?? fetch;

  async function call(op: string, args: unknown[]): Promise<unknown> {
    const authHeader = opts.authHeader?.() ?? null;
    const res = await doFetch(`${base}/api/desk/${op}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body: encode({ args }),
      // Same-origin web/PWA carries the session cookie; the native client sends a
      // Bearer header instead (cross-origin, cookie-less) so this is a harmless no-op there.
      credentials: "include",
    });

    const text = await res.text();
    if (!res.ok) {
      let message = `desk RPC ${op} failed (${res.status})`;
      let code: string | undefined;
      let provider: string | undefined;
      try {
        const body = JSON.parse(text) as {
          error?: { message?: string; code?: string; provider?: string };
        };
        if (body?.error?.message) message = body.error.message;
        code = body?.error?.code;
        provider = body?.error?.provider;
      } catch {
        /* non-JSON error body — keep the generic message */
      }
      // Reconstruct a typed AI error so the UI maps it exactly like a local (in-process) one.
      if (code?.startsWith("ai/")) {
        throw new AIProviderError(
          code.slice(3) as AIErrorCode,
          (provider as AIProviderType) ?? "openai",
          message,
        );
      }
      throw new Error(message);
    }

    return decode<{ result: unknown }>(text).result;
  }

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      // Methods are always string-keyed. Reject symbols and `then` so an
      // accidental `await remoteService` (promise-detection) can't fire a
      // bogus RPC.
      if (typeof prop !== "string" || prop === "then") return undefined;
      return (...args: unknown[]) => call(prop, args);
    },
  };

  return new Proxy({}, handler) as unknown as DeskService;
}
