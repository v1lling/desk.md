/**
 * Content Move - Move docs between projects and folders
 */
import type { Doc, DocKind, ContentScope } from "@/types";
import { normalizeDate, generatePreview, filenameToId } from "./parser";
import { isTauri, joinPath } from "./env";
import { findFileById, readMarkdownFile, moveMarkdownFile } from "./file-operations";
import { mockDocs } from "./mock-data";
import { WORKSPACE_LEVEL_PROJECT_ID } from "./constants";
import { getDocsPath, getAIDocsPath } from "./paths";
import { getHomeWorkspaceId } from "./workspaces";
import { getAllDocsForWorkspace } from "./content-tree";

interface DocFrontmatter extends Record<string, unknown> {
  title: string;
  created: string;
}

/**
 * Move doc to a different project (physically moves the file)
 */
export async function moveDocToProject(
  docId: string,
  workspaceId: string,
  fromProjectId: string,
  toProjectId: string
): Promise<Doc | null> {
  if (!isTauri()) {
    const index = mockDocs.findIndex((d) => d.id === docId && d.workspaceId === workspaceId);
    if (index === -1) return null;
    mockDocs[index] = { ...mockDocs[index], projectId: toProjectId };
    return mockDocs[index];
  }

  if (fromProjectId === toProjectId) {
    const docs = await getAllDocsForWorkspace(workspaceId);
    return docs.find((d) => d.id === docId) || null;
  }

  const fromDocsPath = await getDocsPath("project", workspaceId, fromProjectId);
  const baseId = docId.split("/").pop()!;
  const sourceFilePath = await findFileById(fromDocsPath, baseId);
  if (!sourceFilePath) return null;

  const parsed = await readMarkdownFile<DocFrontmatter>(sourceFilePath);
  if (!parsed) return null;

  const toDocsPath = await getDocsPath("project", workspaceId, toProjectId);
  const sourceFilename = sourceFilePath.split("/").pop()!;
  const targetFilePath = await joinPath(toDocsPath, sourceFilename);

  // moveMarkdownFile handles mkdir, cache invalidation, registry notification
  await moveMarkdownFile(sourceFilePath, targetFilePath);

  return {
    // Lands at the target project's docs root, so ID is just the filename.
    id: filenameToId(sourceFilename),
    projectId: toProjectId,
    workspaceId,
    filePath: targetFilePath,
    title: parsed.frontmatter.title,
    created: normalizeDate(parsed.frontmatter.created),
    content: parsed.content,
    preview: generatePreview(parsed.content),
  };
}

function resolveBasePath(
  kind: DocKind,
  scope: ContentScope,
  workspaceId?: string,
  projectId?: string
): Promise<string> {
  return kind === "ai"
    ? getAIDocsPath(scope, workspaceId, projectId)
    : getDocsPath(scope, workspaceId, projectId);
}

/**
 * Move a doc to a different folder (within the same scope). `fromKind` and `toKind`
 * may differ — that's a cross-section move (e.g. dragging an AI draft into `docs/`).
 */
export async function moveDoc(
  scope: ContentScope,
  docId: string,
  fromPath: string,
  toPath: string,
  workspaceId?: string,
  projectId?: string,
  fromKind: DocKind = "human",
  toKind: DocKind = fromKind
): Promise<Doc | null> {
  if (!isTauri()) {
    const doc = mockDocs.find((d) => d.id === docId);
    if (doc) {
      // docId is a scope-relative path; the filename is its last segment.
      const baseFilename = `${docId.split("/").pop()!}.md`;
      doc.path = toPath ? `${toPath}/${baseFilename}` : baseFilename;
      doc.id = filenameToId(doc.path);
      // Reflect cross-kind moves in the mock filePath so subsequent path-based
      // kind derivation picks up the new directory.
      if (fromKind !== toKind) {
        const oldSeg = fromKind === "ai" ? "/ai-docs/" : "/docs/";
        const newSeg = toKind === "ai" ? "/ai-docs/" : "/docs/";
        doc.filePath = doc.filePath.replace(oldSeg, newSeg);
      }
    }
    return doc || null;
  }

  const fromBasePath = await resolveBasePath(fromKind, scope, workspaceId, projectId);
  const toBasePath = await resolveBasePath(toKind, scope, workspaceId, projectId);
  const fromDir = fromPath
    ? await joinPath(fromBasePath, fromPath)
    : fromBasePath;

  // docId is the scope-relative path; findFileById scans a single dir by
  // basename, so strip the folder portion before matching.
  const baseId = docId.split("/").pop()!;
  const sourceFilePath = await findFileById(fromDir, baseId);
  if (!sourceFilePath) return null;

  const parsed = await readMarkdownFile<DocFrontmatter>(sourceFilePath);
  if (!parsed) return null;

  const sourceFilename = sourceFilePath.split("/").pop()!;
  const toDir = toPath ? await joinPath(toBasePath, toPath) : toBasePath;
  const targetFilePath = await joinPath(toDir, sourceFilename);

  // moveMarkdownFile handles mkdir, cache invalidation, registry notification
  await moveMarkdownFile(sourceFilePath, targetFilePath);

  const newRelPath = toPath
    ? `${toPath}/${sourceFilename}`
    : sourceFilename;

  const homeWorkspaceId = await getHomeWorkspaceId();
  return {
    // ID follows the doc's new location.
    id: filenameToId(newRelPath),
    path: newRelPath,
    projectId: projectId || (scope === "workspace" ? WORKSPACE_LEVEL_PROJECT_ID : homeWorkspaceId),
    workspaceId: workspaceId || homeWorkspaceId,
    filePath: targetFilePath,
    title: parsed.frontmatter.title,
    created: normalizeDate(parsed.frontmatter.created),
    content: parsed.content,
    preview: generatePreview(parsed.content),
  };
}
