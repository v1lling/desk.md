import { blocksOverlap } from "@desk/core";
import type { WorkspaceBlock } from "@desk/core/types";

export interface MinuteRange {
  startMinute: number;
  endMinute: number;
}

export function planBlockMove(
  requestedStart: number,
  duration: number,
  targetBlocks: WorkspaceBlock[],
  movingBlockId: string,
): MinuteRange | null {
  const startMinute = Math.min(Math.max(requestedStart, 0), 1440 - duration);
  const candidate = { startMinute, endMinute: startMinute + duration };
  const overlaps = targetBlocks
    .filter((block) => block.id !== movingBlockId)
    .some((block) => blocksOverlap(candidate, block));

  return overlaps ? null : candidate;
}

export function clampBlockResize(
  edge: "top" | "bottom",
  requestedStart: number,
  requestedEnd: number,
  siblingBlocks: WorkspaceBlock[],
): MinuteRange {
  let startMinute = requestedStart;
  let endMinute = requestedEnd;
  const sortedSiblings = [...siblingBlocks].sort(
    (left, right) => left.startMinute - right.startMinute,
  );

  for (const sibling of sortedSiblings) {
    if (!blocksOverlap({ startMinute, endMinute }, sibling)) continue;
    if (edge === "top") {
      startMinute = sibling.endMinute;
    } else {
      endMinute = sibling.startMinute;
    }
  }

  if (endMinute - startMinute < 30) {
    if (edge === "top") {
      startMinute = endMinute - 30;
    } else {
      endMinute = startMinute + 30;
    }
  }

  return {
    startMinute: Math.max(0, startMinute),
    endMinute: Math.min(1440, endMinute),
  };
}

export function planTaskDropOnEmptyGrid(
  requestedStart: number,
  gridStartMinute: number,
  gridEndMinute: number,
  blocks: WorkspaceBlock[],
  duration = 60,
): MinuteRange | null {
  const startMinute = Math.min(
    Math.max(requestedStart, gridStartMinute),
    gridEndMinute - 30,
  );
  const upperBound = blocks
    .filter((block) => block.startMinute >= startMinute)
    .reduce((limit, block) => Math.min(limit, block.startMinute), gridEndMinute);
  const endMinute = Math.min(startMinute + duration, upperBound);
  const candidate = { startMinute, endMinute };

  if (endMinute - startMinute < 30) return null;
  if (blocks.some((block) => blocksOverlap(candidate, block))) return null;
  return candidate;
}

export function canAddTaskToBlock(
  task: { id: string; workspaceId: string },
  block: WorkspaceBlock,
): boolean {
  return (
    block.workspaceId === task.workspaceId &&
    !block.taskIds.includes(task.id)
  );
}
