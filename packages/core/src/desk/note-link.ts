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
}

const DESK_PROTOCOL = "desk://";
const VALID_TYPES: NoteLinkType[] = ["doc", "task", "meeting"];

export function createNoteLinkHref(type: NoteLinkType, id: string): string {
  return `${DESK_PROTOCOL}${type}/${id}`;
}

export function parseNoteLinkHref(href: string): NoteLink | null {
  if (!href.startsWith(DESK_PROTOCOL)) return null;
  const path = href.slice(DESK_PROTOCOL.length);
  const slashIndex = path.indexOf("/");
  if (slashIndex === -1) return null;
  const type = path.slice(0, slashIndex) as NoteLinkType;
  const id = path.slice(slashIndex + 1);
  if (!VALID_TYPES.includes(type) || !id) return null;
  return { type, id };
}

export function isNoteLinkHref(href: string): boolean {
  return href.startsWith(DESK_PROTOCOL);
}
