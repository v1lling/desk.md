/**
 * MCP front door (step 4) — read-only.
 *
 * Exposes the desk domain's read tools (the same tree/read/search/catalog/workspace-info
 * the in-app assistant has) over the Model Context Protocol so external agents — Claude.ai
 * / ChatGPT custom connectors, Claude Code via mcp-remote — can browse a self-hosted desk.
 * Tools run through `getDeskService()`, so on the server they read the server's files and
 * honour each workspace's `.aiignore` (enforcement lives in the domain's agent-queries).
 *
 * Auth: every request is gated by an OAuth 2.1 access token minted by the Better Auth AS
 * (see auth.ts) and bound to this MCP resource's audience (RFC 8707). An unauthenticated
 * request gets a 401 carrying the `WWW-Authenticate: Bearer resource_metadata=...` challenge
 * the spec requires, which is how a connector discovers the AS and starts the OAuth dance.
 *
 * Transport: the MCP SDK's web-standard Streamable HTTP transport (Fetch Request/Response),
 * stateless + JSON responses, so it drops straight onto a Hono route with no Node req/res
 * bridging. Writes are intentionally NOT exposed yet (read-only v1).
 */
import { randomUUID } from "node:crypto";
import type { Hono } from "hono";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import {
  getDeskService,
  PATH_SEGMENTS,
  loadAIIgnoreEntries,
  isPathExcludedByAIIgnore,
} from "@desk/core";
import { auth, baseURL, MCP_RESOURCE, OAUTH_ISSUER, OAUTH_JWKS_URL } from "./auth";

const PRM_URL = `${baseURL}/.well-known/oauth-protected-resource`;

/** Data-root-relative path for a workspace file (mirrors the app tool layer's helper). */
function workspacePath(workspaceId: string, path?: string): string {
  const base = `${PATH_SEGMENTS.WORKSPACES}/${workspaceId}`;
  return path ? `${base}/${path}` : base;
}

/** JSON tool result in MCP's content shape. */
function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

/**
 * Build a fresh MCP server with the read-only tool set. Created per request (stateless
 * transport), so there is no shared session state to leak between connectors.
 */
function buildServer(): McpServer {
  const server = new McpServer({ name: "desk.md", version: "0.9.1" });
  const svc = getDeskService();

  server.registerTool(
    "desk_workspace_info",
    {
      description:
        "List all workspaces and their projects (ids + names). Start here to learn the workspace_id and project_id values the other tools need.",
      inputSchema: {},
    },
    async () => json(await svc.deskWorkspaceInfo())
  );

  server.registerTool(
    "desk_tree",
    {
      description:
        "Get a workspace's file tree as a flat list of workspace-relative paths (usable with desk_read). Omit path for the full tree; only pass path to drill in when the full tree was truncated.",
      inputSchema: { workspace_id: z.string().min(1), path: z.string().optional() },
    },
    async ({ workspace_id, path }) => json(await svc.deskTree(workspace_id, path))
  );

  server.registerTool(
    "desk_read",
    {
      description:
        "Read the full content of a workspace file. Use after desk_tree or desk_catalog to read candidate files before making factual claims.",
      inputSchema: { workspace_id: z.string().min(1), path: z.string().min(1) },
    },
    async ({ workspace_id, path }) => json(await svc.deskReadFile(workspacePath(workspace_id, path)))
  );

  server.registerTool(
    "desk_search",
    {
      description:
        "Full-text search across a workspace's files. Use for specific text, quotes, or keywords.",
      inputSchema: {
        workspace_id: z.string().min(1),
        query: z.string().min(1),
        path: z.string().optional(),
      },
    },
    async ({ workspace_id, query, path }) =>
      json(await svc.deskFullTextSearch(query, workspacePath(workspace_id, path)))
  );

  server.registerTool(
    "desk_catalog",
    {
      description:
        "Get the AI-curated catalog (path, type, title, summary, date) for a workspace, newest-first. May be empty if no index has been built yet — fall back to desk_tree then.",
      inputSchema: { workspace_id: z.string().min(1) },
    },
    async ({ workspace_id }) => json(await readCatalog(workspace_id))
  );

  return server;
}

/**
 * desk_catalog reads the persisted Smart Index cache (.desk/index/indexes.json) via the
 * DeskService. The payload is the app's zustand-persist envelope ({ state: { indexes } });
 * we parse defensively and apply the workspace's .aiignore, degrading to an empty catalog
 * (with a hint) when no index exists — the server can't build one until server-side AI lands.
 */
async function readCatalog(workspaceId: string) {
  const raw = await getDeskService().getIndexCache();
  const empty = {
    workspace_id: workspaceId,
    entries: [],
    total: 0,
    message: "No index built yet. Use desk_tree for file listing.",
  };
  if (!raw) return empty;

  let entries: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(raw) as { state?: { indexes?: Record<string, { entries?: unknown[] }> } };
    const ws = parsed.state?.indexes?.[workspaceId];
    entries = (ws?.entries as Array<Record<string, unknown>>) ?? [];
  } catch {
    return empty;
  }
  if (entries.length === 0) return empty;

  const aiignore = await loadAIIgnoreEntries(workspaceId);
  const visible = aiignore.length
    ? entries.filter((e) => !isPathExcludedByAIIgnore(String(e.path ?? ""), aiignore))
    : entries;
  visible.sort((a, b) =>
    String(b.date ?? b.created ?? "").localeCompare(String(a.date ?? a.created ?? ""))
  );

  return { workspace_id: workspaceId, total: visible.length, entries: visible };
}

// Resource-server view of the AS: validates access tokens in-process (same Better Auth
// instance / DB), so no client credentials or network introspection round-trip is needed.
// Passing `auth` gives the client the shared context; actions live under getActions().
const resourceActions = oauthProviderResourceClient(auth).getActions();

/** 401 with the spec-required discovery challenge so a connector can find the AS. */
function unauthorized(detail?: string): Response {
  return new Response(JSON.stringify({ error: "unauthorized", detail }), {
    status: 401,
    headers: {
      "content-type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${PRM_URL}"`,
    },
  });
}

/**
 * Mount POST/GET/DELETE /mcp. Token is validated first; only a valid, audience-bound token
 * reaches the MCP transport. Mirrors registerDeskApi(app)'s shape (desk-api.ts).
 */
export function registerMcp(app: Hono): void {
  // Protected Resource Metadata (RFC 9728) — REQUIRED by the MCP spec. The AS does not
  // serve this; the resource server (us) must. Points connectors at the AS to discover it.
  app.get("/.well-known/oauth-protected-resource", async (c) => {
    const meta = await resourceActions.getProtectedResourceMetadata({
      resource: MCP_RESOURCE,
      authorization_servers: [OAUTH_ISSUER],
    });
    return c.json(meta);
  });

  // OAuth Authorization Server metadata at the ROOT well-known paths. Our issuer is
  // <origin>/api/auth, so a spec client derives the metadata URL as either the RFC 8414
  // path-aware form (/.well-known/oauth-authorization-server/api/auth) or the OIDC form;
  // Better Auth only serves it under /api/auth. We forward the root forms to it IN-APP so
  // discovery works without a reverse-proxy rewrite (local dev, MCP Inspector) and behind
  // Caddy alike. Registered before the SPA static catch-all, so they return JSON not HTML.
  const forwardWellKnown = (target: string) => (c: { req: { raw: Request } }) => {
    const url = new URL(c.req.raw.url);
    url.pathname = target;
    return auth.handler(new Request(url, c.req.raw));
  };
  const asMeta = forwardWellKnown("/api/auth/.well-known/oauth-authorization-server");
  const oidcMeta = forwardWellKnown("/api/auth/.well-known/openid-configuration");
  app.get("/.well-known/oauth-authorization-server", asMeta);
  app.get("/.well-known/oauth-authorization-server/api/auth", asMeta);
  app.get("/.well-known/openid-configuration", oidcMeta);
  app.get("/.well-known/openid-configuration/api/auth", oidcMeta);

  app.on(["POST", "GET", "DELETE"], "/mcp", async (c) => {
    // Validate the OAuth token on EVERY request (sessions don't bypass auth).
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return unauthorized("missing bearer token");
    try {
      await resourceActions.verifyAccessToken(token, {
        verifyOptions: { audience: MCP_RESOURCE, issuer: OAUTH_ISSUER },
        jwksUrl: OAUTH_JWKS_URL,
      });
    } catch (err) {
      return unauthorized(err instanceof Error ? err.message : "invalid token");
    }

    // Stateful Streamable HTTP: `initialize` (no session header) spins up a transport and
    // returns an mcp-session-id; later requests carry that header and reuse the transport.
    // This is the handshake Claude/ChatGPT connectors drive (a stateless server would
    // reject tools/list as "not initialized").
    const sessionId = c.req.header("mcp-session-id");
    let transport = sessionId ? sessions.get(sessionId) : undefined;
    if (!transport) {
      transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sid) => {
          sessions.set(sid, transport!);
        },
        onsessionclosed: (sid) => {
          sessions.delete(sid);
        },
      });
      await buildServer().connect(transport);
    }
    return transport.handleRequest(c.req.raw);
  });
}

// Live MCP sessions keyed by mcp-session-id. Entries are removed on session close (DELETE).
const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();
