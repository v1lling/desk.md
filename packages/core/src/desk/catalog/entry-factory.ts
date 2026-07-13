import { hashContent, extractBody } from "./content-utils";
import type { CatalogEntry } from "./types";

/** Derive the workspace-relative path from an absolute file path. */
export function extractRelativePath(absolutePath: string, workspaceId: string): string {
  const workspaceMarker = `/workspaces/${workspaceId}/`;
  const markerIndex = absolutePath.indexOf(workspaceMarker);

  if (markerIndex !== -1) {
    return absolutePath.slice(markerIndex + workspaceMarker.length);
  }

  const lastSlash = absolutePath.lastIndexOf("/");
  return lastSlash !== -1 ? absolutePath.slice(lastSlash + 1) : absolutePath;
}

export interface BuildCatalogEntryInput {
  filePath: string;
  workspaceId: string;
  type: CatalogEntry["type"];
  title: string;
  projectId: string;
  created?: string;
  updated?: string;
  content: string;
  projectName?: string;
  status?: string;
  priority?: string;
  date?: string;
}

/**
 * Build a single catalog entry (metadata only, no summary). The hash is always
 * computed over the body so it stays stable whether or not frontmatter is present.
 */
export async function buildCatalogEntry(input: BuildCatalogEntryInput): Promise<CatalogEntry> {
  return {
    path: extractRelativePath(input.filePath, input.workspaceId),
    filePath: input.filePath,
    type: input.type,
    title: input.title,
    contentHash: await hashContent(extractBody(input.content)),
    created: input.created,
    updated: input.updated,
    projectId: input.projectId,
    projectName: input.projectName,
    status: input.status,
    priority: input.priority,
    date: input.date,
  };
}
