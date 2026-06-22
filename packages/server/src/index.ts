/**
 * desk.md server — Step 2 skeleton.
 *
 * Proves the @desk/core domain layer runs off-Tauri: a Node 22 + Hono app that
 * boots the domain on a NodeFsProvider and exposes it over HTTP. NO auth, NO
 * MCP, NO RemoteDeskService yet — those are steps 3-5. Two smoke routes plus
 * static SPA serving.
 */
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { getDeskService } from "@desk/core";
import { boot, resolveDataRoot } from "./boot";

boot();

const app = new Hono();

// Liveness.
app.get("/health", (c) => c.json({ ok: true, dataRoot: resolveDataRoot() }));

// Smoke: exercises the domain (getWorkspaces) against the real NodeFsProvider.
// On the server isMockMode() is false, so this reads actual files, not mocks.
app.get("/smoke/workspaces", async (c) => {
  const workspaces = await getDeskService().getWorkspaces();
  return c.json({ count: workspaces.length, workspaces });
});

// Serve the built SPA (packages/app/dist) for any non-API route. Requires
// `npm run build -w @desk/app` first; harmless (404s) if not built yet.
app.use("/*", serveStatic({ root: "../app/dist" }));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`desk.md server on http://localhost:${info.port} (data: ${resolveDataRoot()})`);
});
