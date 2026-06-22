/**
 * desk.md server — domain API + auth (steps 2-3b).
 *
 * A Node 22 + Hono app that boots the @desk/core domain on a NodeFsProvider and
 * exposes it over HTTP behind a Better Auth session gate, plus the SPA. NO MCP,
 * NO OAuth Authorization Server yet — those are steps 4-5.
 */
import { relative } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { boot } from "./boot";
import { registerDeskApi } from "./desk-api";
import { auth, hasUsers, migrateAuth } from "./auth";

boot();

const app = new Hono();

// SPA dist dir, resolved relative to this file (not the cwd) so the server works
// regardless of launch directory (matters for Docker). @hono/node-server's
// serveStatic resolves `root`/`path` against process.cwd(), so compute the
// cwd-relative path from import.meta.dirname (packages/server/src → packages/app/dist).
const distDir = relative(process.cwd(), new URL("../../app/dist", import.meta.url).pathname);
const indexHtml = `${distDir}/index.html`;

// Liveness (open). Intentionally minimal — no data-root path leak on an open endpoint.
app.get("/health", (c) => c.json({ ok: true }));

// Better Auth handler — sign-up/in/out, session. Must precede the static
// catch-all. Takes a web Request, which Hono exposes as c.req.raw.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// First-run gate signal (open — leaks only a boolean): lets the client choose the
// create-account vs login screen before anyone is authenticated.
app.get("/api/auth-status", async (c) => c.json({ hasUsers: await hasUsers() }));

// Domain API (RPC, session-gated) — must be registered before the static
// catch-all below.
registerDeskApi(app);

// Unknown API paths must 404 as JSON, not fall through to the SPA index.html.
// Registered after every real /api route, before the static serving below.
app.all("/api/*", (c) => c.json({ error: { message: "Not found" } }, 404));

// Serve the built SPA (packages/app/dist). Requires `npm run build:hosted -w
// @desk/app` first; harmless (404s) if not built yet. Real files (assets,
// index.html at /) are served here; unmatched files fall through to next().
app.use("/*", serveStatic({ root: distDir }));

// SPA history fallback: client-side routes (React Router) have no file on disk,
// so any remaining GET serves index.html.
app.get("/*", serveStatic({ path: indexHtml }));

const port = Number(process.env.PORT ?? 8787);

// Create/upgrade the auth schema before accepting traffic, so the first sign-up
// on a fresh deployment can't hit a missing `user` table.
await migrateAuth();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`desk.md server on http://localhost:${info.port}`);
});
