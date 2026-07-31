/**
 * Internal Note Link Utilities
 *
 * URI format: desk://doc/2024-01-15-architecture
 *             desk://task/2024-02-01-fix-login
 *             desk://meeting/2024-03-10-standup
 */

export type NoteLinkType = "doc" | "task" | "meeting";

export interface NoteLink {
  type: NoteLinkType;
  id: string;
  workspaceId?: string;
  projectId?: string;
}

const DESK_PROTOCOL = "desk://";
const VALID_TYPES: NoteLinkType[] = ["doc", "task", "meeting"];

export function createNoteLinkHref(
  type: NoteLinkType,
  id: string,
  workspaceId?: string,
  projectId?: string,
): string {
  if (workspaceId && projectId) {
    return `${DESK_PROTOCOL}${type}/v2/${encodeURIComponent(workspaceId)}/${encodeURIComponent(projectId)}/${encodeURIComponent(id)}`;
  }
  return `${DESK_PROTOCOL}${type}/${id}`;
}

export function parseNoteLinkHref(href: string): NoteLink | null {
  if (!href.startsWith(DESK_PROTOCOL)) return null;
  const path = href.slice(DESK_PROTOCOL.length);
  const slashIndex = path.indexOf("/");
  if (slashIndex === -1) return null;
  const type = path.slice(0, slashIndex) as NoteLinkType;
  const identityPath = path.slice(slashIndex + 1);
  if (!VALID_TYPES.includes(type) || !identityPath) return null;
  const segments = identityPath.split("/");
  if (segments.length === 4 && segments[0] === "v2") {
    try {
      const [workspaceId, projectId, id] = segments.slice(1).map(decodeURIComponent);
      if (!workspaceId || !projectId || !id) return null;
      return { type, id, workspaceId, projectId };
    } catch {
      return null;
    }
  }
  const id = identityPath;
  if (!id) return null;
  return { type, id };
}
