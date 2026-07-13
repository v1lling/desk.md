/**
 * Content Move - Move a doc between any (scope, project, folder, kind) location.
 */
import type { Doc, DocKind, ContentScope } from "../types";
import { resolveContentDate, normalizeDateTime, generatePreview, filenameToId } from "./parser";
import { isMockMode, joinPath } from "./env";
import { findFileById, readMarkdownFile, moveMarkdownFile } from "./file-operations";
import { mockDocs } from "./mock-data";
import { WORKSPACE_LEVEL_PROJECT_ID } from "./constants";
import { getDocsPath, getAIDocsPath } from "./paths";
import { getHomeWorkspaceId } from "./workspaces";

interface DocFrontmatter extends Record<string, unknown> {
  title: string;
  created?: string;
  updated?: string;
}

/**
 * A doc's physical location: which scope/project it belongs to, the folder path
 * within that scope's docs root, and whether it lives in `docs/` (human) or
 * `ai-docs/` (ai). A move is fully described by a `from` and a `to` of this shape.
 */
export interface DocLocation {
  scope: ContentScope;
  projectId?: string;
  /** Folder path relative to the scope's docs root ("" = root). */
  folderPath: string;
  kind: DocKind;
}

function resolveBasePath(loc: DocLocation, workspaceId?: string): Promise<string> {
  return loc.kind === "ai"
    ? getAIDocsPath(loc.scope, workspaceId, loc.projectId)
    : getDocsPath(loc.scope, workspaceId, loc.projectId);
}

/** The projectId a doc carries once it lives at `loc` (workspace-level docs use a sentinel). */
function projectIdFor(loc: DocLocation, homeWorkspaceId: string): string {
  return loc.projectId ?? (loc.scope === "workspace" ? WORKSPACE_LEVEL_PROJECT_ID : homeWorkspaceId);
}

/**
 * Move a doc from one location to another. `from`/`to` may differ in scope,
 * project, folder, and kind — this single primitive covers folder reorder,
 * cross-kind (`docs/` ↔ `ai-docs/`), project↔project, and workspace↔project moves.
 *
 * Physically moves the file; the returned `Doc` reflects the new id/path/projectId.
 */
export async function moveDoc(
  docId: string,
  workspaceId: string,
  from: DocLocation,
  to: DocLocation
): Promise<Doc | null> {
  if (isMockMode()) {
    const doc = mockDocs.find((d) => d.id === docId);
    if (doc) {
      // docId is a scope-relative path; the filename is its last segment.
      const baseFilename = `${docId.split("/").pop()!}.md`;
      doc.path = to.folderPath ? `${to.folderPath}/${baseFilename}` : baseFilename;
      doc.id = filenameToId(doc.path);
      doc.projectId = projectIdFor(to, doc.workspaceId);
      // Reflect cross-kind moves in the mock filePath so subsequent path-based
      // kind derivation picks up the new directory.
      if (from.kind !== to.kind) {
        const oldSeg = from.kind === "ai" ? "/ai-docs/" : "/docs/";
        const newSeg = to.kind === "ai" ? "/ai-docs/" : "/docs/";
        doc.filePath = doc.filePath.replace(oldSeg, newSeg);
      }
    }
    return doc || null;
  }

  const fromBasePath = await resolveBasePath(from, workspaceId);
  const toBasePath = await resolveBasePath(to, workspaceId);
  const fromDir = from.folderPath ? await joinPath(fromBasePath, from.folderPath) : fromBasePath;

  // docId is the scope-relative path; findFileById scans a single dir by
  // basename, so strip the folder portion before matching.
  const baseId = docId.split("/").pop()!;
  const sourceFilePath = await findFileById(fromDir, baseId);
  if (!sourceFilePath) return null;

  const parsed = await readMarkdownFile<DocFrontmatter>(sourceFilePath);
  if (!parsed) return null;

  const sourceFilename = sourceFilePath.split("/").pop()!;
  const toDir = to.folderPath ? await joinPath(toBasePath, to.folderPath) : toBasePath;
  const targetFilePath = await joinPath(toDir, sourceFilename);

  const homeWorkspaceId = await getHomeWorkspaceId();
  const newRelPath = to.folderPath ? `${to.folderPath}/${sourceFilename}` : sourceFilename;

  // Same source and destination — nothing to move; return the doc as-is.
  if (targetFilePath !== sourceFilePath) {
    // moveMarkdownFile handles mkdir, cache invalidation, registry notification
    await moveMarkdownFile(sourceFilePath, targetFilePath);
  }

  return {
    // ID follows the doc's new location.
    id: filenameToId(newRelPath),
    path: newRelPath,
    projectId: projectIdFor(to, homeWorkspaceId),
    workspaceId: workspaceId || homeWorkspaceId,
    filePath: targetFilePath,
    title: parsed.frontmatter.title,
    // Filename is unchanged by a move, so its date prefix still applies as fallback.
    created: resolveContentDate(parsed.frontmatter.created, newRelPath),
    updated: normalizeDateTime(parsed.frontmatter.updated),
    content: parsed.content,
    preview: generatePreview(parsed.content),
  };
}
