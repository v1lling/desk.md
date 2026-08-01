import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getDeskService,
} from "@desk/core";
import { setDataRootResolver, setStorage } from "@desk/core/host";
import { NodeFsProvider } from "../packages/server/src/node-fs-provider";

function markdownBody(markdown: string): string {
  const closing = markdown.indexOf("---", 3);
  return markdown.slice(closing + 3);
}

class RejectEntityWritesProvider extends NodeFsProvider {
  override async writeTextFile(path: string, content: string): Promise<void> {
    if (path.endsWith("/workspace.md") || path.endsWith("/project.md")) {
      throw new Error("simulated entity write failure");
    }
    await super.writeTextFile(path, content);
  }
}

async function verify(root: string) {
  setStorage(new NodeFsProvider(root));
  setDataRootResolver(async () => root);

  const {
    createDocInFolder,
    createFolder,
    createMeeting,
    createProject,
    createTask,
    createWorkspace,
    deskFullTextSearch,
    deskReadFile,
    deskTree,
    getContentTree,
    getMeeting,
    getProject,
    getTask,
    getWorkspace,
    importFiles,
    moveDoc,
    updateMeeting,
    updateProject,
    updateTask,
    updateWorkspace,
  } = getDeskService();

  const workspace = await createWorkspace({
    id: "acme",
    name: "Acme",
    description: "Client delivery workspace",
  });
  assert.match(workspace.overview ?? "", /Client delivery workspace/);
  assert.equal(existsSync(join(root, "workspaces/acme/context")), false);
  for (const path of ["docs", "_unassigned/docs", "_unassigned/tasks", "_unassigned/meetings"]) {
    assert.equal(existsSync(join(root, "workspaces/acme", path)), true, path);
  }

  const workspaceMd = join(root, "workspaces/acme/workspace.md");
  const workspaceBody = markdownBody(await readFile(workspaceMd, "utf8"));
  await updateWorkspace("acme", { color: "#123456" });
  assert.equal(markdownBody(await readFile(workspaceMd, "utf8")), workspaceBody);
  await updateWorkspace("acme", { overview: "A deliberately edited workspace overview." });
  assert.equal((await getWorkspace("acme"))?.overview, "A deliberately edited workspace overview.");

  const project = await createProject({
    workspaceId: "acme",
    name: "Website",
    description: "Rebuild the public site",
  });
  assert.equal(project.overview, undefined);
  const projectRoot = join(root, "workspaces/acme/projects/website");
  assert.equal(existsSync(join(projectRoot, "context")), false);
  for (const path of ["docs", "tasks", "meetings"]) {
    assert.equal(existsSync(join(projectRoot, path)), true, path);
  }

  const projectMd = join(projectRoot, "project.md");
  const projectBody = markdownBody(await readFile(projectMd, "utf8"));
  await updateProject("website", { status: "paused" }, "acme");
  assert.equal(markdownBody(await readFile(projectMd, "utf8")), projectBody);
  await updateProject("website", { overview: "Edited project orientation." }, "acme");
  assert.equal((await getProject("acme", "website"))?.overview, "Edited project orientation.");

  await createFolder("project", "Research/Nested", "acme", "website");
  const doc = await createDocInFolder({
    scope: "project",
    workspaceId: "acme",
    projectId: "website",
    folderPath: "Research/Nested",
    title: "Agent research",
    content: "Research body",
    author: "ai",
  });
  const moved = await moveDoc(
    doc.id,
    "acme",
    { scope: "project", projectId: "website", folderPath: "Research/Nested" },
    { scope: "project", projectId: "website", folderPath: "Archive" },
  );
  assert.equal(moved?.author, "ai");
  assert.match(moved?.path ?? "", /^Archive\//);

  const imported = await importFiles(
    [{ name: "notes.md", content: "---\ntitle: Imported\nauthor: ai\n---\nImported body\n" }],
    "project",
    "Imports/Nested",
    "acme",
    "website",
  );
  assert.equal(imported.docs[0]?.author, "ai");
  const tree = await getContentTree("project", "acme", "website");
  assert.equal(JSON.stringify(tree).includes("Research"), true);
  assert.equal(JSON.stringify(tree).includes("Imports"), true);

  await writeFile(join(root, "workspaces/acme/.aiignore"), "projects/website/\n");
  const agentTree = await deskTree("acme");
  assert.equal(
    agentTree.entries.some((entry) => entry.path === "workspace.md" && entry.kind === "workspace"),
    true,
  );
  assert.equal(
    agentTree.entries.some((entry) => entry.path.includes("projects/website/docs/")),
    false,
  );
  assert.match(
    (await deskReadFile("workspaces/acme/projects/website/project.md")).content,
    /Edited project orientation/,
  );
  assert.equal(
    agentTree.entries.some(
      (entry) => entry.path === "projects/website/project.md" && entry.kind === "project",
    ),
    true,
  );
  const overviewSearch = await deskFullTextSearch("Edited project orientation", "workspaces/acme");
  assert.equal(overviewSearch.matches.some((match) => match.path.endsWith("project.md")), true);

  const task = await createTask({
    workspaceId: "acme",
    projectId: "website",
    title: "AI task",
    author: "ai",
  });
  await updateTask(task.id, { status: "doing" }, "acme", "website");
  assert.equal((await getTask("acme", "website", task.id))?.author, "ai");

  const meeting = await createMeeting({
    workspaceId: "acme",
    projectId: "website",
    title: "AI meeting",
    author: "ai",
  });
  await updateMeeting(meeting.id, { title: "AI meeting updated" }, "acme", "website");
  assert.equal((await getMeeting("acme", "website", meeting.id))?.author, "ai");

  // Update failures must reject so editors keep their drafts and show an error.
  setStorage(new RejectEntityWritesProvider(root));
  await assert.rejects(
    updateProject("website", { overview: "Must remain unsaved." }, "acme"),
    /simulated entity write failure/,
  );
  await assert.rejects(
    updateWorkspace("acme", { overview: "Must remain unsaved." }),
    /simulated entity write failure/,
  );
  setStorage(new NodeFsProvider(root));
  assert.equal((await getProject("acme", "website"))?.overview, "Edited project orientation.");
  assert.equal((await getWorkspace("acme"))?.overview, "A deliberately edited workspace overview.");
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "deskmd-storage-"));
  try {
    await verify(root);
    console.log("storage fixture verified");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
