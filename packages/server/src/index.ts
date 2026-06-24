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
import { cors } from "hono/cors";
import { boot } from "./boot";
import { registerDeskApi } from "./desk-api";
import { registerMcp } from "./mcp";
import { auth, hasUsers, migrateAuth } from "./auth";

boot();

const app = new Hono();

// CORS for browser-based MCP clients (MCP Inspector, web connectors). The MCP
// authorization spec assumes the client runs in a browser: it fetches discovery
// metadata, registers (DCR), and exchanges the auth code for a token via cross-origin
// `fetch()` from its own origin. Without these headers the browser blocks every one of
// those reads ("Failed to fetch"), discovery silently fails, and the client falls back
// to guessing endpoint paths at the origin root (/token, /authorize) — which is the real
// cause of the downstream `invalid_client` / `missing bearer token` failures.
//
// Scope: the OAuth/MCP surface only. Credentials are intentionally OFF — the token
// exchange is a public-client + PKCE flow that carries no cookie, and the /mcp resource
// authenticates with a Bearer header, not the session cookie. Reflecting the origin
// without `Allow-Credentials` therefore adds no CSRF surface (a cross-site page still
// can't attach or read the session cookie). The authorize endpoint is reached by a
// top-level browser NAVIGATION, not fetch, so it neither needs nor gets CORS here.
const mcpCors = cors({
  origin: (origin) => origin ?? "*",
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "mcp-session-id", "mcp-protocol-version"],
  exposeHeaders: ["mcp-session-id", "WWW-Authenticate"],
  maxAge: 600,
});
app.use("/mcp", mcpCors);
app.use("/.well-known/*", mcpCors);
app.use("/api/auth/*", mcpCors);

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

// MCP front door (step 4, read-only) + its protected-resource metadata. OAuth-gated
// (RFC 8707 audience-bound tokens from the Better Auth AS). Before the static catch-all.
registerMcp(app);

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
