/**
 * Content Move - Move a doc between any (scope, project, folder, kind) location.
 */
import type { Doc, ContentScope } from "../types";
import { generatePreview, filenameToId } from "./parser";
import {
  decodeDocFrontmatter,
  reportFrontmatterDiagnostics,
} from "./frontmatter";
import { joinPath } from "./env";
import { findFileById, readMarkdownFile, moveMarkdownFile } from "./file-operations";
import { WORKSPACE_LEVEL_PROJECT_ID } from "./constants";
import { getDocsPath } from "./paths";
import { getHomeWorkspaceId } from "./workspaces";

/**
 * A doc's physical location: scope/project plus the folder within its docs root.
 */
export interface DocLocation {
  scope: ContentScope;
  projectId?: string;
  /** Folder path relative to the scope's docs root ("" = root). */
  folderPath: string;
}

function resolveBasePath(loc: DocLocation, workspaceId?: string): Promise<string> {
  return getDocsPath(loc.scope, workspaceId, loc.projectId);
}

/** The projectId a doc carries once it lives at `loc` (workspace-level docs use a sentinel). */
function projectIdFor(loc: DocLocation, homeWorkspaceId: string): string {
  return loc.projectId ?? (loc.scope === "workspace" ? WORKSPACE_LEVEL_PROJECT_ID : homeWorkspaceId);
}

/**
 * Move a doc between folders, projects, or workspace scope.
 *
 * Physically moves the file; the returned `Doc` reflects the new id/path/projectId.
 */
export async function moveDoc(
  docId: string,
  workspaceId: string,
  from: DocLocation,
  to: DocLocation
): Promise<Doc | null> {
  const fromBasePath = await resolveBasePath(from, workspaceId);
  const toBasePath = await resolveBasePath(to, workspaceId);
  const fromDir = from.folderPath ? await joinPath(fromBasePath, from.folderPath) : fromBasePath;

  // docId is the scope-relative path; findFileById scans a single dir by
  // basename, so strip the folder portion before matching.
  const baseId = docId.split("/").pop()!;
  const sourceFilePath = await findFileById(fromDir, baseId);
  if (!sourceFilePath) return null;

  const parsed = await readMarkdownFile<Record<string, unknown>>(sourceFilePath);
  if (!parsed) return null;

  const sourceFilename = sourceFilePath.split("/").pop()!;
  const toDir = to.folderPath ? await joinPath(toBasePath, to.folderPath) : toBasePath;
  const targetFilePath = await joinPath(toDir, sourceFilename);

  const homeWorkspaceId = await getHomeWorkspaceId();
  const newRelPath = to.folderPath ? `${to.folderPath}/${sourceFilename}` : sourceFilename;
  const decoded = decodeDocFrontmatter(
    parsed.frontmatter,
    sourceFilename.replace(/\.md$/, ""),
    newRelPath,
  );
  reportFrontmatterDiagnostics("document", sourceFilePath, decoded.diagnostics);

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
    title: decoded.value.title,
    // Filename is unchanged by a move, so its date prefix still applies as fallback.
    created: decoded.value.created,
    updated: decoded.value.updated,
    author: decoded.value.author,
    content: parsed.content,
    preview: generatePreview(parsed.content),
  };
}
