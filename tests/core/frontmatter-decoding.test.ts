import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearHomeWorkspaceCache,
  createDoc,
  createMeeting,
  createProject,
  createTask,
  createWorkspace,
  decodeDocFrontmatter,
  decodeMeetingFrontmatter,
  decodeProjectFrontmatter,
  decodeTaskFrontmatter,
  decodeWorkspaceFrontmatter,
  getDoc,
  getMeetingsByProject,
  getProject,
  getProjects,
  getTasksByProject,
  parseMarkdown,
  resetContentCache,
  resetFileTreeService,
  serializeMarkdown,
  setDataRootResolver,
  setStorage,
  updateDoc,
  updateMeeting,
  updateProject,
  updateTask,
  updateWorkspace,
} from "../../packages/core/src";
import { NodeFsProvider } from "../../packages/server/src/node-fs-provider";

describe("frontmatter decoding", () => {
  let root: string;
  let provider: NodeFsProvider;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "deskmd-frontmatter-"));
    provider = new NodeFsProvider(root);
    setStorage(provider);
    setDataRootResolver(async () => root);
    clearHomeWorkspaceCache();
    resetContentCache();
    resetFileTreeService();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("applies documented defaults and rejects invalid typed values", () => {
    const workspace = decodeWorkspaceFrontmatter(
      { name: 42, description: ["wrong"], created: "not-a-date", home: "yes" },
      "workspace-id",
    );
    expect(workspace.value).toMatchObject({
      name: "workspace-id",
      description: undefined,
      home: false,
    });

    const project = decodeProjectFrontmatter(
      { name: "Project", status: "nearly-done", created: "2026-07-30" },
      "project-id",
    );
    expect(project.value.status).toBe("active");

    const task = decodeTaskFrontmatter(
      { title: "Task", status: "blocked", priority: "urgent", due: "2026-02-30" },
      "fallback",
      "2026-07-29-task.md",
    );
    expect(task.value).toMatchObject({
      status: "todo",
      priority: undefined,
      due: undefined,
      created: "2026-07-29",
    });

    const doc = decodeDocFrontmatter(
      { title: {}, author: "robot", updated: "tomorrow-ish" },
      "Document",
      "document.md",
    );
    expect(doc.value).toMatchObject({
      title: "Document",
      author: undefined,
      updated: undefined,
    });

    const meeting = decodeMeetingFrontmatter(
      { title: "Meeting", created: "2026-07-28", date: "unknown" },
      "Meeting",
      "meeting.md",
    );
    expect(meeting.value.date).toBe("2026-07-28");

    expect([
      ...workspace.diagnostics,
      ...project.diagnostics,
      ...task.diagnostics,
      ...doc.diagnostics,
      ...meeting.diagnostics,
    ].map((diagnostic) => diagnostic.field)).toEqual(
      expect.arrayContaining([
        "name",
        "description",
        "created",
        "home",
        "status",
        "priority",
        "due",
        "author",
        "updated",
        "date",
      ]),
    );
  });

  it("keeps unknown user fields through every entity update path", async () => {
    const workspace = await createWorkspace({ id: "acme", name: "Acme", home: true });
    const workspacePath = join(root, "workspaces", workspace.id, "workspace.md");
    await addFrontmatter(workspacePath, { customWorkspace: { owner: "user" } });
    await updateWorkspace(workspace.id, { description: "Updated" });
    expect(await frontmatterAt(workspacePath)).toMatchObject({
      customWorkspace: { owner: "user" },
      description: "Updated",
    });

    const project = await createProject({ workspaceId: workspace.id, name: "Website" });
    const projectPath = join(
      root,
      "workspaces",
      workspace.id,
      "projects",
      project.id,
      "project.md",
    );
    await addFrontmatter(projectPath, { customProject: ["keep"] });
    await updateProject(project.id, { description: "Updated" }, workspace.id);
    expect(await frontmatterAt(projectPath)).toMatchObject({
      customProject: ["keep"],
      description: "Updated",
    });

    const task = await createTask({
      workspaceId: workspace.id,
      projectId: project.id,
      title: "Task",
    });
    await addFrontmatter(task.filePath, { customTask: true });
    await updateTask(task.id, { status: "doing" }, workspace.id, project.id);
    expect(await frontmatterAt(task.filePath)).toMatchObject({
      customTask: true,
      status: "doing",
    });

    const createdDoc = await createDoc({
      workspaceId: workspace.id,
      projectId: project.id,
      title: "Document",
    });
    await addFrontmatter(createdDoc.filePath, { customDoc: 7 });
    resetContentCache();
    resetFileTreeService();
    const doc = await getDoc(workspace.id, createdDoc.id);
    expect(doc).not.toBeNull();
    await updateDoc(doc!, { title: "Updated document" });
    expect(await frontmatterAt(createdDoc.filePath)).toMatchObject({
      customDoc: 7,
      title: "Updated document",
    });

    const meeting = await createMeeting({
      workspaceId: workspace.id,
      projectId: project.id,
      title: "Meeting",
    });
    await addFrontmatter(meeting.filePath, { customMeeting: "keep" });
    await updateMeeting(
      meeting.id,
      { title: "Updated meeting" },
      workspace.id,
      project.id,
    );
    expect(await frontmatterAt(meeting.filePath)).toMatchObject({
      customMeeting: "keep",
      title: "Updated meeting",
    });
  });

  it("returns partially valid records with diagnostics and isolates invalid YAML", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const workspace = await createWorkspace({ id: "acme", name: "Acme", home: true });
    const project = await createProject({ workspaceId: workspace.id, name: "Valid project" });
    const projectPath = join(
      root,
      "workspaces",
      workspace.id,
      "projects",
      project.id,
      "project.md",
    );
    await addFrontmatter(projectPath, { status: "invented", description: 99 });

    const task = await createTask({
      workspaceId: workspace.id,
      projectId: project.id,
      title: "Partially valid task",
    });
    await addFrontmatter(task.filePath, { status: "blocked", priority: "urgent" });
    resetContentCache();
    resetFileTreeService();

    expect((await getProject(workspace.id, project.id))?.status).toBe("active");
    expect((await getTasksByProject(workspace.id, project.id))[0]).toMatchObject({
      status: "todo",
      priority: undefined,
    });

    const brokenPath = join(
      root,
      "workspaces",
      workspace.id,
      "projects",
      "broken",
    );
    await provider.mkdir(brokenPath);
    await provider.writeTextFile(
      join(brokenPath, "project.md"),
      "---\nname: [unterminated\n---\n",
    );

    expect((await getProjects(workspace.id)).map((item) => item.id)).toContain(project.id);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[frontmatter] project "'),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('invalid "status"'),
    );
  });

  async function addFrontmatter(
    path: string,
    extra: Record<string, unknown>,
  ): Promise<void> {
    const raw = await provider.readTextFile(path);
    const parsed = parseMarkdown<Record<string, unknown>>(raw);
    await provider.writeTextFile(path, serializeMarkdown({ ...parsed.data, ...extra }, parsed.content));
  }

  async function frontmatterAt(path: string): Promise<Record<string, unknown>> {
    return parseMarkdown<Record<string, unknown>>(await provider.readTextFile(path)).data;
  }
});
