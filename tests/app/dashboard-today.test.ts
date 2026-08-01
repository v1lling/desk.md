import { describe, expect, it } from "vitest";
import { selectCurrentAndUpcomingBlocks } from "../../packages/app/src/lib/dashboard-today";
import type { WorkspaceBlock } from "@desk/core/types";

function block(id: string, startMinute: number, endMinute: number): WorkspaceBlock {
  return { id, startMinute, endMinute, workspaceId: "workspace", taskIds: [] };
}

describe("dashboard Today block selection", () => {
  const blocks = [
    block("past", 480, 540),
    block("current", 600, 660),
    block("next", 720, 780),
    block("later", 840, 900),
    block("last", 960, 1020),
  ];

  it("keeps the current block and the next two in chronological order", () => {
    expect(selectCurrentAndUpcomingBlocks(blocks, 630).map((item) => item.id)).toEqual([
      "current",
      "next",
      "later",
    ]);
  });

  it("drops a block exactly when it ends", () => {
    expect(selectCurrentAndUpcomingBlocks(blocks, 660, 2).map((item) => item.id)).toEqual([
      "next",
      "later",
    ]);
  });

  it("returns an empty list after the final block and for an empty day", () => {
    expect(selectCurrentAndUpcomingBlocks(blocks, 1020)).toEqual([]);
    expect(selectCurrentAndUpcomingBlocks([], 600)).toEqual([]);
  });

  it("sorts unsorted input without mutating it", () => {
    const unsorted = [block("later", 700, 760), block("first", 600, 660)];
    expect(selectCurrentAndUpcomingBlocks(unsorted, 500).map((item) => item.id)).toEqual([
      "first",
      "later",
    ]);
    expect(unsorted.map((item) => item.id)).toEqual(["later", "first"]);
  });
});
