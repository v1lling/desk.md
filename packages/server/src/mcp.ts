/**
 * MCP front door (step 4) — read-only.
 *
 * Exposes the desk domain's read tools (tree/read/search/catalog/workspace-info) over the
 * Model Context Protocol so external agents — Claude.ai / ChatGPT custom connectors, Claude
 * Code via mcp-remote — can browse a self-hosted desk. Tools run through `getDeskService()`,
 * so on the server they read the server's files and honour each workspace's `.aiignore`
 * (enforcement lives in the domain's agent-queries). Also exposes one MCP *prompt*,
 * `draft-email-reply`, which turns a pasted email into a reply-drafting request (the desktop
 * email tab is now just a viewer that copies the email text for this prompt).
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
import { getDeskService, PATH_SEGMENTS } from "@desk/core";
import type { WorkspaceCatalog } from "@desk/core";
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
 * Drafting guidance for the `draft-email-reply` prompt. Ported from the (now-removed) in-app
 * assistant's draft-email mode so the email-reply habit survives via MCP. Kept server-local
 * because @desk/server can't import from @desk/app.
 */
const DRAFT_EMAIL_GUIDANCE = `Draft a professional email reply to the email below.

- Match the language, tone, greeting, and closing of the original email.
- Be clear and concise. Output ONLY the email body, with no subject line and no headers.
- Plain text only: no markdown bold/italic/headers. Bullet and numbered lists are fine.
- If the reply intent is unclear, ask one short follow-up before drafting.
- Don't invent sender/recipient names or metadata.

Write like a person, not an AI. Avoid the tells that make text read as machine-generated:
- NEVER use em dashes or en dashes. Use commas, periods, parentheses, or two sentences instead. This is the most important rule.
- No filler openers ("I hope this email finds you well", "I wanted to reach out").
- No corporate/AI buzzwords: delve, leverage, robust, seamless, streamline, navigate, underscore, utilize, facilitate, furthermore, moreover, additionally, that said.
- No rule-of-three triads or restating what the sender already said back to them.
- No padded enthusiasm or "Hope this helps!" / "Feel free to reach out!" closers unless the original tone warrants it.
- Don't over-explain or hedge. Say what's needed and stop. Vary sentence length so it doesn't read as uniform AI prose.

If drafting the reply would benefit from workspace context (a referenced doc, task, or meeting), use this connector's desk_workspace_info / desk_tree / desk_search / desk_read tools to pull it before writing.`;

/**
 * Build a fresh MCP server with the read-only tool set. Created per request (stateless
 * transport), so there is no shared session state to leak between connectors.
 */
function buildServer(): McpServer {
  const server = new McpServer({ name: "desk.md", version: "0.10.0" });
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
        "Structural fallback: a workspace's raw file tree as a flat list of workspace-relative paths, including assets and non-content files. Prefer desk_catalog to understand a workspace's content; use desk_tree to see structure or find a file the catalog doesn't list. Omit path for the full tree; pass path to drill in when truncated.",
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
        "Full-text search across a workspace's SOURCE files. By default the query is split into words and a file matches only when EVERY word appears somewhere in it (good for multi-word research); words match punctuation-insensitively (edu-id = eduid). Wrap the query in double quotes for an exact-phrase match. Snippets are capped; generated agent files are skipped. Note: this searches source content only — a concept that exists only in an AI summary won't appear here, so fall back to desk_catalog for summary-level discovery.",
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
        "Start here: the workspace's content catalog — every doc, task, and meeting with path, type, title, status/date, last-updated timestamp, and an AI summary when one has been generated (summary may be absent until then). Always populated, most recently updated first. Returns one page; narrow with project_id/type/status/since and page with limit/offset (response has total + has_more). Use desk_read to open specific files; use desk_tree only for raw structure.",
      inputSchema: {
        workspace_id: z.string().min(1),
        project_id: z.string().optional(),
        type: z.enum(["doc", "ai-doc", "task", "meeting"]).optional(),
        status: z.string().optional(),
        since: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
          .optional()
          .describe("ISO date (YYYY-MM-DD); only entries updated/dated on or after it."),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async (args) => json(await readCatalog(args))
  );

  // Prompt: draft-email-reply. Paste the original email (copied from desk's email tab) and
  // optional instructions; the connector composes a reply-drafting request. The read tools
  // above are available to the same conversation for pulling workspace context.
  server.registerPrompt(
    "draft-email-reply",
    {
      title: "Draft an email reply",
      description:
        "Draft a reply to an email. Paste the original email text (copied from desk's email tab) plus optional instructions; the model writes a ready-to-send reply and can pull workspace context via the desk tools.",
      argsSchema: {
        email_text: z
          .string()
          .min(1)
          .describe("The original email to reply to (headers + body), e.g. copied from desk's email tab."),
        instructions: z
          .string()
          .optional()
          .describe("Optional guidance for the reply: tone, key points, a decision to convey."),
      },
    },
    ({ email_text, instructions }) => {
      const parts = [DRAFT_EMAIL_GUIDANCE, "", "Original email:", email_text.trim()];
      if (instructions && instructions.trim()) {
        parts.push("", "Additional instructions:", instructions.trim());
      }
      return {
        messages: [{ role: "user", content: { type: "text", text: parts.join("\n") } }],
      };
    }
  );

  return server;
}

/**
 * desk_catalog: the always-complete metadata catalog, built LIVE from the server's files
 * (so it's never empty just because no AI key exists), with AI summaries merged in by path.
 *
 * Metadata comes fresh from the core catalog builder (`.aiignore` already applied there);
 * summaries come from the persisted Smart Index cache (.desk/index/indexes.json), which a
 * key-bearing desktop client contributes. A short in-process TTL memo absorbs bursty agent
 * calls; if no cache exists, every summary is just absent and the metadata stands alone.
 *
 * The full catalog is built/memoized once; filtering (project/type/status/since), newest-first
 * sorting and limit/offset paging are applied per-request on top, so a large workspace returns a
 * bounded page instead of one oversized blob.
 */
const CATALOG_TTL_MS = 15_000;
const catalogMemo = new Map<string, { at: number; value: WorkspaceCatalog }>();

async function getCachedCatalog(workspaceId: string): Promise<WorkspaceCatalog> {
  const memo = catalogMemo.get(workspaceId);
  if (memo && Date.now() - memo.at < CATALOG_TTL_MS) return memo.value;
  const value = await getDeskService().buildWorkspaceCatalog(workspaceId);
  catalogMemo.set(workspaceId, { at: Date.now(), value });
  return value;
}

/** Parse the zustand-persist envelope and extract path → AI summary (real summaries only). */
async function loadSummaryMap(workspaceId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const raw = await getDeskService().getIndexCache();
  if (!raw) return map;
  try {
    const parsed = JSON.parse(raw) as {
      state?: { indexes?: Record<string, { entries?: Array<Record<string, unknown>> }> };
    };
    const entries = parsed.state?.indexes?.[workspaceId]?.entries ?? [];
    for (const e of entries) {
      const path = typeof e.path === "string" ? e.path : "";
      const summary = typeof e.summary === "string" ? e.summary : "";
      if (path && summary) map.set(path, summary);
    }
  } catch {
    // Malformed cache — summaries just stay absent.
  }
  return map;
}

interface CatalogQuery {
  workspace_id: string;
  project_id?: string;
  type?: "doc" | "ai-doc" | "task" | "meeting";
  status?: string;
  since?: string;
  limit?: number;
  offset?: number;
}

const DEFAULT_CATALOG_LIMIT = 50;

async function readCatalog(q: CatalogQuery) {
  const catalog = await getCachedCatalog(q.workspace_id);
  const summaries = await loadSummaryMap(q.workspace_id);

  // The entry's effective date for `since`/sort: last save, else meeting date, else
  // creation date. `updated` is a full ISO datetime; comparing it against a date-only
  // `since` bound stays correct lexicographically ("2026-07-09T…" >= "2026-07-09").
  // Undated entries collapse to "" — they sort last (desc) and never match `since`.
  const dateOf = (e: { updated?: string; date?: string; created?: string }) =>
    e.updated ?? e.date ?? e.created ?? "";

  // Strip the absolute server filePath — agents address files by the workspace-relative
  // `path` (desk_read), and the host's filesystem layout is not theirs to see.
  const filtered = catalog.entries
    .map(({ filePath: _filePath, ...e }) => ({ ...e, summary: summaries.get(e.path) }))
    .filter((e) => !q.project_id || e.projectId === q.project_id)
    .filter((e) => !q.type || e.type === q.type)
    .filter((e) => !q.status || e.status === q.status)
    .filter((e) => !q.since || dateOf(e) >= q.since)
    .sort((a, b) => dateOf(b).localeCompare(dateOf(a)));

  const offset = Math.max(0, q.offset ?? 0);
  const limit = Math.min(200, Math.max(1, q.limit ?? DEFAULT_CATALOG_LIMIT));
  const page = filtered.slice(offset, offset + limit);

  return {
    workspace_id: q.workspace_id,
    total: filtered.length,
    returned: page.length,
    offset,
    limit,
    has_more: offset + page.length < filtered.length,
    entries: page,
  };
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
