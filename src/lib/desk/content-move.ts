/**
 * Content Move - Move docs between projects and folders
 */
import type { Doc, DocKind, ContentScope } from "@/types";
import { normalizeDate, generatePreview } from "./parser";
import { isTauri, joinPath } from "./tauri-fs";
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
  const sourceFilePath = await findFileById(fromDocsPath, docId);
  if (!sourceFilePath) return null;

  const parsed = await readMarkdownFile<DocFrontmatter>(sourceFilePath);
  if (!parsed) return null;

  const toDocsPath = await getDocsPath("project", workspaceId, toProjectId);
  const sourceFilename = sourceFilePath.split("/").pop()!;
  const targetFilePath = await joinPath(toDocsPath, sourceFilename);

  // moveMarkdownFile handles mkdir, cache invalidation, registry notification
  await moveMarkdownFile(sourceFilePath, targetFilePath);

  return {
    id: docId,
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
      doc.path = toPath ? `${toPath}/${doc.id}.md` : `${doc.id}.md`;
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

  const sourceFilePath = await findFileById(fromDir, docId);
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
    id: docId,
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
