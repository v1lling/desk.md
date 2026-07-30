import { describe, expect, it } from "vitest";
import type { WorkspaceBlock } from "../../packages/core/src/types";
import {
  canAddTaskToBlock,
  clampBlockResize,
  planBlockMove,
  planTaskDropOnEmptyGrid,
} from "../../packages/app/src/lib/planner-interactions";

function block(
  id: string,
  startMinute: number,
  endMinute: number,
): WorkspaceBlock {
  return {
    id,
    workspaceId: "work",
    taskIds: [],
    startMinute,
    endMinute,
  };
}

describe("planner block movement", () => {
  it("clamps moves to the day while preserving duration", () => {
    expect(planBlockMove(-60, 90, [], "moving")).toEqual({
      startMinute: 0,
      endMinute: 90,
    });
    expect(planBlockMove(1410, 90, [], "moving")).toEqual({
      startMinute: 1350,
      endMinute: 1440,
    });
  });

  it("rejects collisions but ignores the moving block itself", () => {
    const blocks = [block("moving", 540, 600), block("occupied", 660, 720)];

    expect(planBlockMove(660, 60, blocks, "moving")).toBeNull();
    expect(planBlockMove(600, 60, blocks, "moving")).toEqual({
      startMinute: 600,
      endMinute: 660,
    });
  });
});

describe("planner block resizing", () => {
  it("stops the dragged edge at neighbouring blocks", () => {
    const previous = block("previous", 480, 540);
    const next = block("next", 660, 720);

    expect(clampBlockResize("top", 510, 660, [previous, next])).toEqual({
      startMinute: 540,
      endMinute: 660,
    });
    expect(clampBlockResize("bottom", 540, 690, [previous, next])).toEqual({
      startMinute: 540,
      endMinute: 660,
    });
  });

  it("enforces a 30-minute minimum and day bounds", () => {
    expect(clampBlockResize("top", 1430, 1440, [])).toEqual({
      startMinute: 1410,
      endMinute: 1440,
    });
    expect(clampBlockResize("bottom", 0, 10, [])).toEqual({
      startMinute: 0,
      endMinute: 30,
    });
  });
});

describe("task drops on empty planner grid", () => {
  it("creates an hour by default and shortens it at the next block", () => {
    expect(planTaskDropOnEmptyGrid(540, 480, 1080, [])).toEqual({
      startMinute: 540,
      endMinute: 600,
    });
    expect(
      planTaskDropOnEmptyGrid(540, 480, 1080, [block("next", 585, 645)]),
    ).toEqual({
      startMinute: 540,
      endMinute: 585,
    });
  });

  it("rejects occupied starts and gaps shorter than one slot", () => {
    expect(
      planTaskDropOnEmptyGrid(570, 480, 1080, [block("occupied", 540, 600)]),
    ).toBeNull();
    expect(
      planTaskDropOnEmptyGrid(540, 480, 1080, [block("next", 555, 615)]),
    ).toBeNull();
  });
});

describe("task drops on existing planner blocks", () => {
  it("accepts only unassigned tasks from the block's workspace", () => {
    const target = {
      ...block("target", 540, 600),
      taskIds: ["assigned"],
    };

    expect(
      canAddTaskToBlock({ id: "new", workspaceId: "work" }, target),
    ).toBe(true);
    expect(
      canAddTaskToBlock({ id: "assigned", workspaceId: "work" }, target),
    ).toBe(false);
    expect(
      canAddTaskToBlock({ id: "new", workspaceId: "personal" }, target),
    ).toBe(false);
  });
});
