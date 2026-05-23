import { hashContent } from "@/lib/context-index/content-utils";
import type { IndexEntry } from "./types";

export function extractRelativePath(absolutePath: string, workspaceId: string): string {
  const workspaceMarker = `/workspaces/${workspaceId}/`;
  const markerIndex = absolutePath.indexOf(workspaceMarker);

  if (markerIndex !== -1) {
    return absolutePath.slice(markerIndex + workspaceMarker.length);
  }

  const lastSlash = absolutePath.lastIndexOf("/");
  return lastSlash !== -1 ? absolutePath.slice(lastSlash + 1) : absolutePath;
}

export interface BuildBaseEntryInput {
  filePath: string;
  workspaceId: string;
  type: IndexEntry["type"];
  title: string;
  projectId: string;
  created: string;
  content: string;
}

export async function buildBaseEntry(input: BuildBaseEntryInput): Promise<IndexEntry> {
  return {
    path: extractRelativePath(input.filePath, input.workspaceId),
    filePath: input.filePath,
    type: input.type,
    title: input.title,
    summary: "",
    contentHash: await hashContent(input.content),
    created: input.created,
    projectId: input.projectId,
  };
}
