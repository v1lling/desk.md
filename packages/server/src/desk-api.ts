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
import { getDeskService, encode, decode } from "@desk/core";
import { auth } from "./auth";

type AnyFn = (...args: unknown[]) => Promise<unknown>;

// Allowed browser origins for the state-changing RPC. Same-origin only for now
// (the server serves the SPA), so the allowlist is just the server's own public
// origin plus localhost for dev. When 3b-native lands (a cross-origin native
// client), this becomes configurable (e.g. a DESK_ALLOWED_ORIGINS env list).
const ALLOWED_ORIGINS = new Set<string>(
  [
    process.env.DESK_PUBLIC_URL && new URL(process.env.DESK_PUBLIC_URL).origin,
    "http://localhost:8787",
    process.env.PORT && `http://localhost:${process.env.PORT}`,
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
      // Full detail (which can include absolute filesystem paths, e.g. "Path
      // escapes data root: /data/...") stays in the server log; the client gets a
      // generic message so the server's layout isn't disclosed over the wire.
      console.error(`[desk-api] op "${op}" failed:`, err);
      return c.json({ error: { message: "Request failed" } }, 500);
    }
  });
}
