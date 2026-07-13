/**
 * useTaskDrag — drag a task out of the rail and into the week.
 *
 * Two drop targets. Onto an existing block of the *same* workspace, the task joins that
 * block. Onto bare grid, a one-hour block is created for the task's own workspace with
 * the task already in it — the task knows its workspace, so there is nothing left to ask.
 *
 * A cross-workspace drop is refused during the hit-test rather than on drop, so the block
 * simply never highlights: a block means "this time belongs to workspace X" (its header
 * and colour say so), and a foreign task inside it would be indistinguishable.
 */

import { useCallback, useRef, useState } from "react";
import { pixelToMinute, blocksOverlap } from "@desk/core";
import { usePlannerStore } from "@/stores/planner";
import { usePointerDrag, DRAG_THRESHOLD_PX } from "./use-pointer-drag";
import { blockAtPoint, dayAtClientX, dayElementAt } from "./grid-hit-test";
import type { ActiveTask } from "@desk/core";
import type { WorkspaceBlock } from "@desk/core/types";

/** Default length of a block conjured by dropping a task on empty grid. */
const NEW_BLOCK_MINUTES = 60;

/** Where the dragged task would land right now. */
export type TaskDropTarget =
  | { kind: "block"; day: string; blockId: string }
  | { kind: "empty"; day: string; startMinute: number; endMinute: number };

interface UseTaskDragArgs {
  weekOf: string;
  dayBlocks: Record<string, WorkspaceBlock[]>;
  gridStartMinute: number;
  gridEndMinute: number;
  slotHeight: number;
}

export function useTaskDrag({
  weekOf,
  dayBlocks,
  gridStartMinute,
  gridEndMinute,
  slotHeight,
}: UseTaskDragArgs) {
  const addBlock = usePlannerStore((s) => s.addBlock);
  const addTaskToBlock = usePlannerStore((s) => s.addTaskToBlock);
  const beginDrag = usePointerDrag();

  const [dragTask, setDragTask] = useState<ActiveTask | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<TaskDropTarget | null>(null);

  // The move handler runs off document listeners, so it must read live values, not the
  // ones captured when the gesture started.
  const geometryRef = useRef({ dayBlocks, gridStartMinute, gridEndMinute, slotHeight });
  geometryRef.current = { dayBlocks, gridStartMinute, gridEndMinute, slotHeight };

  const targetRef = useRef<TaskDropTarget | null>(null);
  targetRef.current = target;

  const resolveTarget = useCallback(
    (task: ActiveTask, clientX: number, clientY: number): TaskDropTarget | null => {
      const day = dayAtClientX(clientX);
      if (!day) return null;

      const { dayBlocks: blocksByDay, gridStartMinute: gs, gridEndMinute: ge, slotHeight: sh } =
        geometryRef.current;
      const blocks = blocksByDay[day] ?? [];

      // Over a block? It only accepts tasks from its own workspace.
      const hit = blockAtPoint(clientX, clientY);
      if (hit) {
        const block = blocks.find((b) => b.id === hit.blockId);
        if (!block || block.workspaceId !== task.workspaceId) return null;
        if (block.taskIds.includes(task.id)) return null;
        return { kind: "block", day, blockId: hit.blockId };
      }

      // Bare grid — a new block, clamped so it cannot grow into its neighbours.
      const column = dayElementAt(day);
      if (!column) return null;

      const rect = column.getBoundingClientRect();
      const start = Math.min(Math.max(pixelToMinute(clientY - rect.top, gs, sh), gs), ge - 30);
      const upperBound = blocks
        .filter((b) => b.startMinute >= start)
        .reduce((hi, b) => Math.min(hi, b.startMinute), ge);
      const end = Math.min(start + NEW_BLOCK_MINUTES, upperBound);

      if (end - start < 30) return null;
      // The cursor is over bare grid, but the tail of the new block still must not collide.
      if (blocks.some((b) => blocksOverlap({ startMinute: start, endMinute: end }, b))) {
        return null;
      }

      return { kind: "empty", day, startMinute: start, endMinute: end };
    },
    []
  );

  const startTaskDrag = useCallback(
    (task: ActiveTask, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();

      beginDrag(e, {
        threshold: DRAG_THRESHOLD_PX,
        cursor: "grabbing",
        onMove: (ev) => {
          setDragTask(task);
          setGhost({ x: ev.clientX, y: ev.clientY });
          setTarget(resolveTarget(task, ev.clientX, ev.clientY));
        },
        onEnd: (moved) => {
          const drop = targetRef.current;

          if (moved) {
            // mouseup landed outside the row, so React's click fires on a common
            // ancestor rather than the row — but suppress one anyway, so a drag can
            // never be mistaken for a click that opens the task.
            const swallow = (ev: MouseEvent) => {
              ev.stopPropagation();
              ev.preventDefault();
            };
            document.addEventListener("click", swallow, { capture: true, once: true });
            setTimeout(() => document.removeEventListener("click", swallow, true), 0);
          }

          if (moved && drop) {
            if (drop.kind === "block") {
              addTaskToBlock(weekOf, drop.day, drop.blockId, task.id);
            } else {
              addBlock(weekOf, drop.day, {
                id: crypto.randomUUID(),
                workspaceId: task.workspaceId,
                taskIds: [task.id],
                startMinute: drop.startMinute,
                endMinute: drop.endMinute,
              });
            }
          }

          setDragTask(null);
          setGhost(null);
          setTarget(null);
        },
        onCancel: () => {
          setDragTask(null);
          setGhost(null);
          setTarget(null);
        },
      });
    },
    [addBlock, addTaskToBlock, beginDrag, resolveTarget, weekOf]
  );

  return { startTaskDrag, dragTask, ghost, target };
}
