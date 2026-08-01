import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDeskService,
} from "@desk/core";
import { setDataRootResolver, setStorage } from "@desk/core/host";
import { NodeFsProvider } from "../../packages/server/src/node-fs-provider";
import { clearHomeWorkspaceCache } from "../../packages/core/src/desk/workspaces";
import {
  FileCollisionError,
  moveDirectoryWithContents,
} from "../../packages/core/src/desk/file-operations";
import {
  resetContentCache,
  resetFileTreeService,
} from "../../packages/core/src/desk/file-cache";

const {
  createCaptureTask,
  createDoc,
  createDocInFolder,
  createMeeting,
  createProject,
  createTask,
  createWorkspace,
  getTasksByProject,
  moveTaskToProject,
  importFiles,
  updateTask,
} = getDeskService();

class RejectTaskWritesProvider extends NodeFsProvider {
  override async writeTextFile(path: string, content: string): Promise<void> {
    if (path.includes("/tasks/")) {
      throw new Error("simulated task write failure");
    }
    await super.writeTextFile(path, content);
  }
}

describe("persistence safety", () => {
  let root: string;
  const cleanupPaths: string[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "deskmd-persistence-"));
    cleanupPaths.push(root);
    setStorage(new NodeFsProvider(root));
    setDataRootResolver(async () => root);
    clearHomeWorkspaceCache();
    resetContentCache();
    resetFileTreeService();

    await createWorkspace({ id: "acme", name: "Acme", home: true });
  });

  afterEach(async () => {
    await Promise.all(
      cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })),
    );
  });

  it("preserves same-title projects and records with deterministic suffixes", async () => {
    const duplicateWorkspace = await createWorkspace({ id: "acme", name: "Acme copy" });
    expect(duplicateWorkspace.id).toBe("acme-2");

    const firstProject = await createProject({ workspaceId: "acme", name: "Website" });
    const secondProject = await createProject({ workspaceId: "acme", name: "Website" });

    expect(firstProject.id).toBe("website");
    expect(secondProject.id).toBe("website-2");

    const firstTask = await createTask({
      workspaceId: "acme",
      projectId: firstProject.id,
      title: "Prepare launch",
      content: "first",
    });
    const secondTask = await createTask({
      workspaceId: "acme",
      projectId: firstProject.id,
      title: "Prepare launch",
      content: "second",
    });

    expect(secondTask.id).toBe(`${firstTask.id}-2`);
    const tasks = await getTasksByProject("acme", firstProject.id);
    expect(tasks.map((task) => task.content.trim()).sort()).toEqual(["first", "second"]);

    const firstMeeting = await createMeeting({
      workspaceId: "acme",
      projectId: firstProject.id,
      title: "Launch review",
    });
    const secondMeeting = await createMeeting({
      workspaceId: "acme",
      projectId: firstProject.id,
      title: "Launch review",
    });
    expect(secondMeeting.id).toBe(`${firstMeeting.id}-2`);

    const firstDoc = await createDoc({
      workspaceId: "acme",
      projectId: firstProject.id,
      title: "Launch notes",
    });
    const secondDoc = await createDoc({
      workspaceId: "acme",
      projectId: firstProject.id,
      title: "Launch notes",
    });
    expect(secondDoc.id).toBe(`${firstDoc.id}-2`);

    const firstNestedDoc = await createDocInFolder({
      scope: "project",
      workspaceId: "acme",
      projectId: firstProject.id,
      folderPath: "Research",
      filename: "notes.md",
      title: "Notes",
    });
    const secondNestedDoc = await createDocInFolder({
      scope: "project",
      workspaceId: "acme",
      projectId: firstProject.id,
      folderPath: "Research",
      filename: "notes.md",
      title: "Notes",
    });
    expect(firstNestedDoc.path).toBe("Research/notes.md");
    expect(secondNestedDoc.path).toBe("Research/notes-2.md");

    const firstCapture = await createCaptureTask({ title: "Call back" });
    const secondCapture = await createCaptureTask({ title: "Call back" });
    expect(secondCapture.id).toBe(`${firstCapture.id}-2`);

    const firstImport = await importFiles(
      [{ name: "attachment.bin", content: new Uint8Array([1]) }],
      "project",
      "Research",
      "acme",
      firstProject.id,
    );
    const secondImport = await importFiles(
      [{ name: "attachment.bin", content: new Uint8Array([2]) }],
      "project",
      "Research",
      "acme",
      firstProject.id,
    );
    expect(firstImport.assets).toEqual(["attachment.bin"]);
    expect(secondImport.assets).toEqual(["attachment-2.bin"]);
  });

  it("rejects a move when the destination already contains the stable id", async () => {
    const source = await createProject({ workspaceId: "acme", name: "Source" });
    const destination = await createProject({ workspaceId: "acme", name: "Destination" });
    const sourceTask = await createTask({
      workspaceId: "acme",
      projectId: source.id,
      title: "Shared title",
    });
    await createTask({
      workspaceId: "acme",
      projectId: destination.id,
      title: "Shared title",
    });

    await expect(
      moveTaskToProject(sourceTask.id, "acme", source.id, destination.id),
    ).rejects.toBeInstanceOf(FileCollisionError);

    expect(await getTasksByProject("acme", source.id)).toHaveLength(1);
    expect(await getTasksByProject("acme", destination.id)).toHaveLength(1);
  });

  it("rejects a directory move when the destination already exists", async () => {
    const sourcePath = join(root, "source-directory");
    const targetPath = join(root, "target-directory");
    const provider = new NodeFsProvider(root);
    await provider.mkdir(sourcePath);
    await provider.mkdir(targetPath);
    await provider.writeTextFile(join(sourcePath, "source.md"), "source");
    await provider.writeTextFile(join(targetPath, "target.md"), "target");

    await expect(
      moveDirectoryWithContents(sourcePath, targetPath),
    ).rejects.toBeInstanceOf(FileCollisionError);

    expect(await provider.readTextFile(join(sourcePath, "source.md"))).toBe("source");
    expect(await provider.readTextFile(join(targetPath, "target.md"))).toBe("target");
  });

  it("propagates operational update failures instead of returning null", async () => {
    const project = await createProject({ workspaceId: "acme", name: "Website" });
    const task = await createTask({
      workspaceId: "acme",
      projectId: project.id,
      title: "Cannot save",
      content: "original",
    });

    setStorage(new RejectTaskWritesProvider(root));
    await expect(
      updateTask(task.id, { status: "doing" }, "acme", project.id),
    ).rejects.toThrow("simulated task write failure");
    expect(await readFile(task.filePath, "utf8")).toContain("status: todo");
  });

  it("refuses reads and writes through a symlink that escapes the data root", async () => {
    const outside = await mkdtemp(join(tmpdir(), "deskmd-outside-"));
    cleanupPaths.push(outside);
    const outsideFile = join(outside, "secret.txt");
    await writeFile(outsideFile, "outside", "utf8");

    const linkedPath = join(root, "linked.txt");
    await symlink(outsideFile, linkedPath);
    const linkedDirectory = join(root, "linked-directory");
    await symlink(outside, linkedDirectory);
    const provider = new NodeFsProvider(root);

    expect(await provider.exists(linkedPath)).toBe(false);
    await expect(provider.readTextFile(linkedPath)).rejects.toThrow(/escapes data root/);
    await expect(provider.writeTextFile(linkedPath, "changed")).rejects.toThrow(
      /escapes data root/,
    );
    await expect(
      provider.writeTextFile(join(linkedDirectory, "created.txt"), "changed"),
    ).rejects.toThrow(/escapes data root/);
    expect(await readFile(outsideFile, "utf8")).toBe("outside");
    await expect(readFile(join(outside, "created.txt"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });

    // A legitimate name beginning with two dots is not a parent traversal.
    const dottedPath = join(root, "..notes");
    await provider.writeTextFile(dottedPath, "inside");
    expect(await provider.readTextFile(dottedPath)).toBe("inside");
  });
});
