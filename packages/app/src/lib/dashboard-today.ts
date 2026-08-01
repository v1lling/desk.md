import type { WorkspaceBlock } from "@desk/core/types";

/** Current and future blocks only, ordered chronologically and capped for the dashboard. */
export function selectCurrentAndUpcomingBlocks(
  blocks: readonly WorkspaceBlock[],
  currentMinute: number,
  limit = 3,
): WorkspaceBlock[] {
  return [...blocks]
    .filter((block) => block.endMinute > currentMinute)
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute)
    .slice(0, limit);
}
