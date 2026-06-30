/**
 * Workspace catalog builder — pure, AI-free, runnable anywhere (incl. the server).
 *
 * Enumerates every doc / ai-doc / task / meeting in a workspace and returns metadata
 * entries (path, title, type, dates, status, contentHash) with NO summaries. The app's
 * summary-enrichment pass layers AI summaries on top by `path`; the MCP server merges
 * persisted summaries at read time. This is the single source of truth for "what files
 * exist", so the catalog is never empty just because no AI key is present.
 */
import { getAllDocsForWorkspace } from "../content-tree";
import { getTasks } from "../tasks";
import { getMeetings } from "../meetings";
import { getProjects } from "../projects";
import { getWorkspace } from "../workspaces";
import { getWorkspacePath } from "../paths";
import { loadAIIgnoreEntries, isPathExcludedByAIIgnore } from "../aiignore";
import { buildCatalogEntry } from "./entry-factory";
import type { CatalogEntry, WorkspaceCatalog } from "./types";

export async function buildWorkspaceCatalog(workspaceId: string): Promise<WorkspaceCatalog> {
  const workspace = await getWorkspace(workspaceId);
  const workspaceName = workspace?.name ?? workspaceId;

  // .aiignore — resolve the workspace path once and slice locally (avoids N async calls).
  const aiignoreEntries = await loadAIIgnoreEntries(workspaceId);
  const workspacePath = (await getWorkspacePath(workspaceId)).replace(/\\/g, "/");
  let excluded = 0;
  const isExcluded = (filePath: string): boolean => {
    if (aiignoreEntries.length === 0) return false;
    const normalized = filePath.replace(/\\/g, "/");
    const relative = normalized.startsWith(workspacePath)
      ? normalized.slice(workspacePath.length).replace(/^\//, "")
      : normalized;
    const hit = isPathExcludedByAIIgnore(relative, aiignoreEntries);
    if (hit) excluded++;
    return hit;
  };

  const projects = await getProjects(workspaceId);
  const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));

  const [docs, aiDocs, tasks, meetings] = await Promise.all([
    getAllDocsForWorkspace(workspaceId, "human"),
    getAllDocsForWorkspace(workspaceId, "ai"),
    getTasks(workspaceId),
    getMeetings(workspaceId),
  ]);

  const entries: CatalogEntry[] = [];

  for (const doc of docs) {
    if (isExcluded(doc.filePath)) continue;
    entries.push(
      await buildCatalogEntry({
        filePath: doc.filePath,
        workspaceId,
        type: "doc",
        title: doc.title,
        projectId: doc.projectId,
        created: doc.created,
        content: doc.content,
        projectName: projectNameMap.get(doc.projectId),
      })
    );
  }

  for (const doc of aiDocs) {
    if (isExcluded(doc.filePath)) continue;
    entries.push(
      await buildCatalogEntry({
        filePath: doc.filePath,
        workspaceId,
        type: "ai-doc",
        title: doc.title,
        projectId: doc.projectId,
        created: doc.created,
        content: doc.content,
        projectName: projectNameMap.get(doc.projectId),
      })
    );
  }

  for (const task of tasks) {
    if (isExcluded(task.filePath)) continue;
    entries.push(
      await buildCatalogEntry({
        filePath: task.filePath,
        workspaceId,
        type: "task",
        title: task.title,
        projectId: task.projectId,
        created: task.created,
        content: task.content,
        projectName: projectNameMap.get(task.projectId),
        status: task.status,
        priority: task.priority,
      })
    );
  }

  for (const meeting of meetings) {
    if (isExcluded(meeting.filePath)) continue;
    entries.push(
      await buildCatalogEntry({
        filePath: meeting.filePath,
        workspaceId,
        type: "meeting",
        title: meeting.title,
        projectId: meeting.projectId,
        created: meeting.created,
        content: meeting.content,
        projectName: projectNameMap.get(meeting.projectId),
        date: meeting.date,
      })
    );
  }

  return {
    workspaceId,
    workspaceName,
    entries,
    builtAt: new Date().toISOString(),
    fileCount: entries.length,
    excluded,
  };
}
