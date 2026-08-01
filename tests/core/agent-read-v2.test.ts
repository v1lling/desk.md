import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDeskService } from "@desk/core";
import {
  InMemoryStorageProvider,
  getStorage,
  resetDeskRuntime,
  setDataRootResolver,
  setStorage,
} from "@desk/core/host";

const root = "DeskData";

const files = [
  {
    path: `${root}/workspaces/acme/workspace.md`,
    content: "---\nname: Acme\ndescription: Client work\ncreated: 2026-01-01\n---\nCanonical Acme orientation.",
  },
  {
    path: `${root}/workspaces/acme/projects/website/project.md`,
    content: "---\nname: Website\nstatus: active\ncreated: 2026-01-01\n---\nWebsite project orientation.",
  },
  {
    path: `${root}/workspaces/acme/projects/website/tasks/2026-01-02-build.md`,
    content: "---\ntitle: Build launch page\nstatus: doing\npriority: high\ndue: 2026-08-10\ncreated: 2026-01-02\n---\nImplement the launch design.",
  },
  {
    path: `${root}/workspaces/acme/projects/website/tasks/2026-01-03-review.md`,
    content: "---\ntitle: Review accessibility\nstatus: waiting\ncreated: 2026-01-03\n---\nWaiting for the audit.",
  },
  {
    path: `${root}/workspaces/acme/projects/website/docs/launch.md`,
    content: "---\ntitle: Launch architecture\ncreated: 2026-02-01\n---\nThe deployment uses a blue green release and edge routing.",
  },
  {
    path: `${root}/workspaces/acme/projects/website/meetings/kickoff.md`,
    content: "---\ntitle: Launch kickoff\ndate: 2026-02-02\ncreated: 2026-02-02\n---\nWe agreed to ship the accessible version first.",
  },
  {
    path: `${root}/workspaces/acme/docs/unicode.md`,
    content: "---\ntitle: Unicode\ncreated: 2026-03-01\n---\nA😀BäC",
  },
  {
    path: `${root}/workspaces/acme/docs/private/secret.md`,
    content: "---\ntitle: Secret\ncreated: 2026-03-02\n---\nprivate-token",
  },
  {
    path: `${root}/workspaces/acme/docs/private/public.md`,
    content: "---\ntitle: Public exception\ncreated: 2026-03-03\n---\npublic-token",
  },
  { path: `${root}/workspaces/acme/docs/brief.pdf`, content: new Uint8Array([0, 1, 2, 3]) },
  { path: `${root}/workspaces/acme/docs/disguised.txt`, content: new Uint8Array([0, 1, 2, 3]) },
  { path: `${root}/workspaces/acme/loose.md`, content: "---\ninvalid: [\n---\nbroken" },
  {
    path: `${root}/workspaces/acme/.aiignore`,
    content: "docs/private/*\n!docs/private/public.md\n",
  },
  {
    path: `${root}/workspaces/other/workspace.md`,
    content: "---\nname: Other\ncreated: 2026-01-01\n---\nOther workspace.",
  },
  {
    path: `${root}/workspaces/other/docs/roadmap.md`,
    content: "---\ntitle: Observatory roadmap\ncreated: 2026-04-01\n---\nTelemetry observability rollout.",
  },
  {
    path: `${root}/.desk/settings/agent-instructions.json`,
    content: JSON.stringify({ global: "Always answer precisely.", perWorkspace: { acme: "legacy" } }),
  },
] as const;

describe("agent read v2", () => {
  beforeEach(() => {
    resetDeskRuntime();
    setStorage(new InMemoryStorageProvider(files));
    setDataRootResolver(async () => root);
  });

  afterEach(() => resetDeskRuntime());

  it("builds desk, workspace, and project context with global instructions", async () => {
    const service = getDeskService();
    const desk = await service.deskContext({});
    expect(desk.scope).toBe("desk");
    expect(desk.custom_instructions).toBe("Always answer precisely.");
    expect(desk.workspaces?.map((workspace) => workspace.id)).toEqual(["acme", "other"]);

    const project = await service.deskContext({ workspace: "Acme", project: "Website" });
    expect(project.scope).toBe("project");
    expect(project.workspace_overview?.content).toContain("Canonical Acme orientation");
    expect(project.project_overview?.content).toContain("Website project orientation");
    expect(project.tasks?.doing.entries[0]).toMatchObject({ title: "Build launch page", due: "2026-08-10" });
    expect(project.tasks?.waiting.entries[0].title).toBe("Review accessibility");
    expect(project.documents?.[0].path).toBe("projects/website/docs/launch.md");
  });

  it("catalogs canonical content, assets, and unknown markdown without excluded files", async () => {
    const catalog = await getDeskService().deskCatalog({ workspace: "acme", limit: 200 });
    expect(catalog.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "doc", path: "projects/website/docs/launch.md", author: "user" }),
      expect.objectContaining({ type: "asset", path: "docs/brief.pdf", mime_type: "application/pdf", size_bytes: 4 }),
      expect.objectContaining({ type: "unknown", path: "loose.md", warning: "noncanonical_markdown" }),
      expect.objectContaining({ type: "doc", path: "docs/private/public.md" }),
    ]));
    expect(catalog.entries.some((entry) => entry.path === "docs/private/secret.md")).toBe(false);
    expect(JSON.stringify(catalog)).not.toContain(root);
  });

  it("uses stable catalog cursors and rejects reuse with different filters", async () => {
    const first = await getDeskService().deskCatalog({ workspace: "acme", limit: 2 });
    expect(first.next_cursor).toBeTruthy();
    const second = await getDeskService().deskCatalog({ workspace: "acme", limit: 2, cursor: first.next_cursor });
    expect(new Set([...first.entries, ...second.entries].map((entry) => entry.path)).size).toBe(4);
    await expect(getDeskService().deskCatalog({
      workspace: "acme",
      type: "doc",
      limit: 2,
      cursor: first.next_cursor,
    })).rejects.toMatchObject({ code: "invalid_cursor" });
  });

  it("uses only content-hash-fresh Smart Index summaries", async () => {
    const body = "The deployment uses a blue green release and edge routing.";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    const freshHash = Array.from(new Uint8Array(digest))
      .map((part) => part.toString(16).padStart(2, "0"))
      .join("");
    await getStorage().writeTextFile(`${root}/.desk/index/indexes.json`, JSON.stringify({
      indexes: {
        acme: {
          workspaceId: "acme",
          workspaceName: "Acme",
          builtAt: "2026-01-01T00:00:00.000Z",
          fileCount: 2,
          entries: [
            {
              path: "projects/website/docs/launch.md",
              filePath: `${root}/workspaces/acme/projects/website/docs/launch.md`,
              type: "doc",
              title: "Launch architecture",
              contentHash: freshHash,
              projectId: "website",
              summary: "Fresh deployment summary",
            },
            {
              path: "docs/unicode.md",
              filePath: `${root}/workspaces/acme/docs/unicode.md`,
              type: "doc",
              title: "Unicode",
              contentHash: "stale-hash",
              projectId: "_workspace",
              summary: "Stale summary must not escape",
            },
          ],
        },
      },
    }));
    const catalog = await getDeskService().deskCatalog({ workspace: "acme", limit: 200 });
    expect(catalog.summaries).toMatchObject({ fresh: 1, stale: 1 });
    expect(catalog.entries.find((entry) => entry.path.endsWith("launch.md"))?.summary)
      .toBe("Fresh deployment summary");
    expect(JSON.stringify(catalog)).not.toContain("Stale summary must not escape");
  });

  it("searches globally, ranks fuzzy titles, and returns one result per file", async () => {
    const global = await getDeskService().deskSearch({ query: "observabilty" });
    expect(global.results[0]).toMatchObject({ workspace_id: "other", path: "docs/roadmap.md", rank: 3 });

    const body = await getDeskService().deskSearch({ query: "blue green", workspace: "acme" });
    expect(body.results[0].path).toBe("projects/website/docs/launch.md");
    expect(body.results[0].snippets).toHaveLength(1);
    expect(new Set(body.results.map((entry) => entry.path)).size).toBe(body.results.length);

    const exact = await getDeskService().deskSearch({ query: "accessible version", exact: true });
    expect(exact.results[0].type).toBe("meeting");
    expect(exact.results.some((entry) => entry.path.includes("secret"))).toBe(false);
  });

  it("reads Unicode by code-point offset and rejects private, binary, and unsafe paths", async () => {
    const first = await getDeskService().deskRead({ workspace: "acme", path: "docs/unicode.md", max_chars: 2 });
    const second = await getDeskService().deskRead({
      workspace: "acme",
      path: "docs/unicode.md",
      offset: first.next_offset,
      max_chars: 50_000,
    });
    expect([...first.content, ...second.content].join("")).toContain("A😀BäC");
    await expect(getDeskService().deskRead({ workspace: "acme", path: "docs/private/secret.md" }))
      .rejects.toMatchObject({ code: "excluded" });
    await expect(getDeskService().deskRead({ workspace: "acme", path: "docs/brief.pdf" }))
      .rejects.toMatchObject({ code: "unsupported_file" });
    await expect(getDeskService().deskRead({ workspace: "acme", path: "docs/disguised.txt" }))
      .rejects.toMatchObject({ code: "unsupported_file" });
    for (const path of ["../.desk/settings/x.json", "/etc/passwd", "docs\\unicode.md", ".desk/index/indexes.json"]) {
      await expect(getDeskService().deskRead({ workspace: "acme", path })).rejects.toMatchObject({ code: "invalid_argument" });
    }
  });

  it("makes overview exclusions authoritative", async () => {
    const storage = new InMemoryStorageProvider([
      ...files,
      { path: `${root}/workspaces/acme/.aiignore`, content: "workspace.md\nprojects/website/project.md\n" },
    ]);
    setStorage(storage);
    const context = await getDeskService().deskContext({ workspace: "acme", project: "website" });
    expect(context.workspace_overview).toMatchObject({ overview_excluded: true });
    expect(context.workspace_overview).not.toHaveProperty("content");
    expect(context.project_overview).toMatchObject({ overview_excluded: true });
    expect(context.project_overview).not.toHaveProperty("content");
    await expect(getDeskService().deskRead({ workspace: "acme", path: "workspace.md" }))
      .rejects.toMatchObject({ code: "excluded" });
  });
});
