/**
 * Domain HTTP API — SEAM 2 over the wire (step 3a) + session gate (step 3b).
 *
 * One RPC endpoint, `POST /api/desk/:op`, that dispatches to the server's
 * in-process DeskService (LocalDeskService on NodeFsProvider). The web client's
 * RemoteDeskService mirrors every method by POSTing `{ args }` here. The contract
 * is the `typeof`-derived DeskService interface, so it can't drift — no
 * per-method routes.
 *
 * Transport: request/response bodies use the @desk/core rpc-codec (base64 for the
 * one Uint8Array arg in importFiles); everything else is plain JSON.
 *
 * Auth (3b): every call requires a valid Better Auth session; unauthenticated
 * requests get 401 before any domain dispatch. The session cookie rides along
 * because RemoteDeskService sends `credentials: "include"`.
 */
import type { Hono } from "hono";
import { getDeskService, encode, decode, isAIProviderError } from "@desk/core";
import { auth, TRUSTED_ORIGINS } from "./auth";

type AnyFn = (...args: unknown[]) => Promise<unknown>;

// Allowed origins for the state-changing RPC: the server's own public origin (it serves the
// SPA) plus localhost for dev, plus TRUSTED_ORIGINS — the shipped desktop app's Tauri origins
// and any DESK_TRUSTED_ORIGINS (e.g. the `npm run tauri:dev` port). The native client may send
// such an Origin (the same one Better Auth's trustedOrigins gates), so the two stay in lockstep.
const ALLOWED_ORIGINS = new Set<string>(
  [
    process.env.DESK_PUBLIC_URL && new URL(process.env.DESK_PUBLIC_URL).origin,
    "http://localhost:8787",
    process.env.PORT && `http://localhost:${process.env.PORT}`,
    ...TRUSTED_ORIGINS,
  ].filter((o): o is string => Boolean(o))
);

export function registerDeskApi(app: Hono): void {
  // The in-process service is LocalDeskService, whose own-enumerable keys are
  // exactly the DeskService methods — the whitelist that stops `:op` from
  // invoking arbitrary properties. Computed once at registration.
  const methods = new Set(Object.keys(getDeskService()));

  app.post("/api/desk/:op", async (c) => {
    // CSRF defense-in-depth: reject cross-origin browser requests before anything
    // else. SameSite=Lax already blocks the cookie cross-site, but this makes the
    // posture explicit and content-type-independent. A present Origin must be in
    // the allowlist; an absent Origin (curl, server-to-server) is allowed through.
    // The native client (step 3b-native) authenticates with a Bearer token, but may
    // still carry a Tauri/dev Origin (tauri://localhost, or the dev port) — that's in
    // ALLOWED_ORIGINS via TRUSTED_ORIGINS, so it passes here and is gated by the session
    // check below. (Bearer auth is CSRF-immune regardless, not being an ambient credential.)
    const origin = c.req.header("origin");
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return c.json({ error: { message: "Forbidden" } }, 403);
    }

    // Session gate: no valid session → 401, before touching the domain.
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return c.json({ error: { message: "Unauthorized" } }, 401);
    }

    const op = c.req.param("op");
    if (!methods.has(op)) {
      return c.json({ error: { message: `Unknown desk op: ${op}` } }, 404);
    }

    let args: unknown[];
    try {
      const body = decode<{ args?: unknown[] }>(await c.req.text());
      args = Array.isArray(body?.args) ? body.args : [];
    } catch {
      return c.json({ error: { message: "Invalid request body" } }, 400);
    }

    try {
      const fn = (getDeskService() as unknown as Record<string, AnyFn>)[op];
      const result = await fn(...args);
      return new Response(encode({ result }), {
        headers: { "content-type": "application/json" },
      });
    } catch (err) {
      console.error(`[desk-api] op "${op}" failed:`, err);
      // AI provider errors carry a machine `code` and a self-authored message (no raw
      // provider prose, no filesystem paths), so they are safe to pass through — the client
      // maps the code to a localized string. Everything else stays opaque: full detail (which
      // can include absolute paths like "Path escapes data root: /data/...") stays in the log.
      if (isAIProviderError(err)) {
        return c.json(
          { error: { code: `ai/${err.code}`, provider: err.provider, message: err.message } },
          502,
        );
      }
      return c.json({ error: { message: "Request failed" } }, 500);
    }
  });
}
