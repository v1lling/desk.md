import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Hono } from "hono";
import { getDeskService } from "@desk/core";
import {
  InMemoryStorageProvider,
  resetDeskRuntime,
  setDataRootResolver,
  setStorage,
} from "@desk/core/host";

const dataRoot = "DeskData";
const authRoot = mkdtempSync(join(tmpdir(), "desk-mcp-contract-"));
process.env.DESK_DATA_ROOT = authRoot;
process.env.DESK_AUTH_DB = join(authRoot, "auth.sqlite");

let createMcpServer: typeof import("../../packages/server/src/mcp").createMcpServer;
let registerMcp: typeof import("../../packages/server/src/mcp").registerMcp;

beforeAll(async () => {
  ({ createMcpServer, registerMcp } = await import("../../packages/server/src/mcp"));
});

afterAll(() => {
  delete process.env.DESK_AUTH_DB;
  delete process.env.DESK_DATA_ROOT;
});

describe("MCP v2 contract", () => {
  beforeEach(() => {
    resetDeskRuntime();
    setStorage(new InMemoryStorageProvider([
      {
        path: `${dataRoot}/workspaces/acme/workspace.md`,
        content: "---\nname: Acme\ncreated: 2026-01-01\n---\nAcme orientation.",
      },
      {
        path: `${dataRoot}/workspaces/acme/docs/guide.md`,
        content: "---\ntitle: Deployment guide\ncreated: 2026-01-02\n---\nDeploy with the release checklist.",
      },
    ]));
    setDataRootResolver(async () => dataRoot);
  });

  afterEach(() => resetDeskRuntime());

  async function connect() {
    const server = createMcpServer(getDeskService());
    const client = new Client({ name: "contract-test", version: "1.0.0" }, { capabilities: {} });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return { client, server };
  }

  it("advertises exactly the v2 tools with structured schemas and annotations", async () => {
    const { client, server } = await connect();
    try {
      expect(client.getInstructions()).toContain("incomplete or out of date");
      expect(client.getServerVersion()?.version).toMatch(/^0\.\d+\.\d+$/);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual([
        "desk_context",
        "desk_catalog",
        "desk_search",
        "desk_read",
      ]);
      for (const tool of tools.tools) {
        expect(tool.outputSchema).toBeTruthy();
        expect(tool.annotations).toMatchObject({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        });
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns validated structured content, safe errors, prompts, and context resources", async () => {
    const { client, server } = await connect();
    try {
      const context = await client.callTool({ name: "desk_context", arguments: { workspace: "acme" } });
      expect(context.isError).not.toBe(true);
      expect(context.structuredContent).toMatchObject({ scope: "workspace" });
      expect(context.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: "text" })]));

      const search = await client.callTool({ name: "desk_search", arguments: { query: "release checklist" } });
      expect(search.structuredContent).toMatchObject({ total: 1, returned: 1 });

      const unsafe = await client.callTool({
        name: "desk_read",
        arguments: { workspace: "acme", path: "../.desk/auth.sqlite" },
      });
      expect(unsafe.isError).toBe(true);
      expect(JSON.stringify(unsafe)).not.toContain(dataRoot);

      const prompts = await client.listPrompts();
      expect(prompts.prompts.map((prompt) => prompt.name)).toContain("draft-email-reply");
      const templates = await client.listResourceTemplates();
      expect(templates.resourceTemplates.map((resource) => resource.uriTemplate)).toEqual([
        "desk://workspaces/{workspace_id}",
        "desk://workspaces/{workspace_id}/projects/{project_id}",
      ]);
      const resources = await client.listResources();
      expect(resources.resources.some((resource) => resource.uri === "desk://workspaces/acme")).toBe(true);
      const resource = await client.readResource({ uri: "desk://workspaces/acme" });
      expect(resource.contents[0]).toMatchObject({ mimeType: "text/markdown" });
      expect("text" in resource.contents[0] && resource.contents[0].text).toContain("Acme orientation");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("gates HTTP sessions and sanitizes authentication failures", async () => {
    const app = new Hono();
    registerMcp(app, {
      verifyAccessToken: async (token) => {
        if (token !== "valid") throw new Error(`${dataRoot}/sensitive-token-detail`);
      },
    });
    const missing = await app.request("/mcp", { method: "POST" });
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain("resource_metadata");

    const invalid = await app.request("/mcp", {
      method: "POST",
      headers: { authorization: "Bearer invalid" },
    });
    expect(invalid.status).toBe(401);
    expect(await invalid.text()).not.toContain(dataRoot);

    const unknown = await app.request("/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer valid",
        "mcp-session-id": "missing-session",
      },
    });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "unknown_mcp_session" });
  });
});
