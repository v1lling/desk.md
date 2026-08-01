import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SPECIAL_DIRS,
  WORKSPACE_LEVEL_PROJECT_ID,
  getDeskService,
} from "@desk/core";
import { InMemoryStorageProvider, resetDeskRuntime } from "@desk/core/host";
import { getAllDocs } from "../../packages/core/src/desk/content-tree";

const {
  createDoc,
  createMeeting,
  createProject,
  createTask,
  createWorkspace,
  deleteDoc,
  deleteMeeting,
  deleteProject,
  deleteTask,
  deleteWorkspace,
  getMeetingsByProject,
  getProjects,
  getTasksByProject,
  getViewState,
  getWorkspaces,
  moveDoc,
  moveMeetingToProject,
  moveTaskToProject,
  updateDoc,
  updateMeeting,
  updateProject,
  updateTask,
  updateWorkspace,
} = getDeskService();

describe("InMemoryStorageProvider", () => {
  it("implements recursive directories, binary files, metadata, moves, and deletes", async () => {
    const storage = new InMemoryStorageProvider([
      { path: "~/DeskMD/a/one.md", content: "one" },
    ]);

    await storage.mkdir("~/DeskMD/a/nested");
    await storage.writeFile("~/DeskMD/a/nested/data.bin", new Uint8Array([1, 2, 3]));

    expect(await storage.readDir("~/DeskMD/a")).toEqual([
      { name: "nested", isDirectory: true, isFile: false },
      { name: "one.md", isDirectory: false, isFile: true },
    ]);
    expect((await storage.fileStat("~/DeskMD/a/nested/data.bin"))?.size).toBe(3);

    await storage.rename("~/DeskMD/a/nested", "~/DeskMD/a/moved");
    expect(await storage.exists("~/DeskMD/a/nested/data.bin")).toBe(false);
    expect(await storage.exists("~/DeskMD/a/moved/data.bin")).toBe(true);

    await expect(
      storage.rename("~/DeskMD/a/one.md", "~/DeskMD/a/moved"),
    ).rejects.toThrow("Destination already exists");

    await storage.removeDir("~/DeskMD/a/moved");
    expect(await storage.exists("~/DeskMD/a/moved/data.bin")).toBe(false);
  });
});

describe("browser filesystem domain parity", () => {
  beforeEach(() => resetDeskRuntime());
  afterEach(() => resetDeskRuntime());

  it("reads representative browser fixtures through canonical Markdown paths", async () => {
    const workspaces = await getWorkspaces();
    expect(workspaces.map((workspace) => workspace.id)).toEqual([
      "personal",
      "acme",
      "side-projects",
    ]);

    const projects = await getProjects("acme");
    const website = projects.find((project) => project.id === "website-redesign");
    expect(website).toMatchObject({
      name: "Website Redesign",
      taskCount: 8,
      docCount: 2,
      meetingCount: 3,
    });

    const nestedDocs = await getAllDocs("project", "acme", "data-migration");
    expect(nestedDocs.some((doc) => doc.id === "Context/legacy-schema")).toBe(true);
    expect(await getViewState("acme", null)).toEqual({
      highlightedTasks: ["review-api-docs", "contact-form-endpoint"],
    });
  });

  it("uses the same create, update, move, and delete functions as filesystem mode", async () => {
    const workspace = await createWorkspace({
      id: "parity",
      name: "Parity",
      description: "Browser filesystem parity",
    });
    expect((await updateWorkspace(workspace.id, { color: "#123456" }))?.color).toBe(
      "#123456",
    );

    const project = await createProject({
      workspaceId: workspace.id,
      name: "Runtime Test",
    });
    expect((await updateProject(project.id, { status: "paused" }, workspace.id))?.status).toBe(
      "paused",
    );

    const task = await createTask({
      workspaceId: workspace.id,
      projectId: project.id,
      title: "Exercise storage path",
      content: "Initial task body",
    });
    expect(
      (await updateTask(
        task.id,
        { status: "doing", content: "Updated task body" },
        workspace.id,
        project.id,
      ))?.content,
    ).toBe("Updated task body");
    const movedTask = await moveTaskToProject(
      task.id,
      workspace.id,
      project.id,
      SPECIAL_DIRS.UNASSIGNED,
    );
    expect(movedTask?.projectId).toBe(SPECIAL_DIRS.UNASSIGNED);
    expect(
      (await getTasksByProject(workspace.id, SPECIAL_DIRS.UNASSIGNED)).map(
        (item) => item.id,
      ),
    ).toContain(task.id);
    expect(
      await deleteTask(task.id, workspace.id, SPECIAL_DIRS.UNASSIGNED),
    ).toBe(true);

    const doc = await createDoc({
      workspaceId: workspace.id,
      projectId: project.id,
      title: "Runtime document",
      content: "# Initial",
    });
    const updatedDoc = await updateDoc(doc, { content: "# Updated" });
    expect(updatedDoc?.content).toBe("# Updated");
    const movedDoc = await moveDoc(
      doc.id,
      workspace.id,
      { scope: "project", projectId: project.id, folderPath: "" },
      { scope: "workspace", folderPath: "" },
    );
    expect(movedDoc?.projectId).toBe(WORKSPACE_LEVEL_PROJECT_ID);
    expect(await deleteDoc(movedDoc!)).toBe(true);

    const meeting = await createMeeting({
      workspaceId: workspace.id,
      projectId: project.id,
      title: "Runtime meeting",
      content: "# Notes",
    });
    expect(
      (await updateMeeting(
        meeting.id,
        { title: "Updated meeting" },
        workspace.id,
        project.id,
      ))?.title,
    ).toBe("Updated meeting");
    const movedMeeting = await moveMeetingToProject(
      meeting.id,
      workspace.id,
      project.id,
      SPECIAL_DIRS.UNASSIGNED,
    );
    expect(movedMeeting?.projectId).toBe(SPECIAL_DIRS.UNASSIGNED);
    expect(
      (await getMeetingsByProject(workspace.id, SPECIAL_DIRS.UNASSIGNED)).map(
        (item) => item.id,
      ),
    ).toContain(meeting.id);
    expect(
      await deleteMeeting(
        meeting.id,
        workspace.id,
        SPECIAL_DIRS.UNASSIGNED,
      ),
    ).toBe(true);

    expect(await deleteProject(project.id, workspace.id)).toBe(true);
    expect(await deleteWorkspace(workspace.id)).toBe(true);
  });

  it("restores pristine seeded files when the runtime is reset", async () => {
    const project = await createProject({
      workspaceId: "acme",
      name: "Temporary browser project",
    });
    expect((await getProjects("acme")).some((item) => item.id === project.id)).toBe(
      true,
    );

    resetDeskRuntime();

    expect((await getProjects("acme")).some((item) => item.id === project.id)).toBe(
      false,
    );
  });
});
