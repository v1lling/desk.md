/**
 * DayColumn — A single day in the time-based week view.
 * Blocks are absolutely positioned by their start/end time.
 * Horizontal grid lines mark each hour. Dragging empty space drafts a new block,
 * which is committed once a workspace is picked.
 */

import { useCallback, useRef, useState } from "react";
import { isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { usePlannerStore } from "@/stores/planner";
import { minuteToPixel, minutesToTime, pixelToMinute, blocksOverlap } from "@desk/core";
import { TimeBlock } from "./workspace-block";
import { WorkspacePickerList } from "./add-block-popover";
import { usePointerDrag, DRAG_THRESHOLD_PX } from "./use-pointer-drag";
import type { TaskDropTarget } from "./use-task-drag";
import type { WorkspaceBlock, Workspace } from "@desk/core/types";
import type { ActiveTask } from "@desk/core";

interface DayColumnProps {
  date: string;
  weekOf: string;
  blocks: WorkspaceBlock[];
  allTasks: ActiveTask[];
  workspaces: Workspace[];
  gridStartMinute: number;
  gridEndMinute: number;
  slotHeight: number;
  /** Minutes from midnight, for the "now" line (only drawn on today's column) */
  nowMinute: number;
  onBlockDragStart?: (blockId: string, day: string, e: React.MouseEvent) => void;
  /** Where a task being dragged out of the rail would land — set only on the hovered day. */
  taskDropTarget?: TaskDropTarget;
  /** Workspace colour of that task, so the pending block previews in its own colour. */
  taskDropColor?: string;
}

/** Draft range being dragged out on empty grid, before a workspace is chosen */
interface DraftRange {
  startMinute: number;
  endMinute: number;
}

export function DayColumn({
  date,
  weekOf,
  blocks,
  allTasks,
  workspaces,
  gridStartMinute,
  gridEndMinute,
  slotHeight,
  nowMinute,
  onBlockDragStart,
  taskDropTarget,
  taskDropColor,
}: DayColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const addBlock = usePlannerStore((s) => s.addBlock);
  const totalSlots = (gridEndMinute - gridStartMinute) / 30;
  const totalHeight = totalSlots * slotHeight;

  const today = isToday(parseISO(date));
  const showNowLine =
    today && nowMinute >= gridStartMinute && nowMinute <= gridEndMinute;

  // ── Drag-to-create ────────────────────────────────────────────────
  // While the mouse is down the draft follows the cursor; on mouseup the draft
  // stays put and anchors a workspace picker. Picking commits it, dismissing drops it.
  const [draft, setDraft] = useState<DraftRange | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const beginDrag = usePointerDrag();

  // Keep the latest blocks/geometry available to the mousemove closure
  const stateRef = useRef({ blocks, gridStartMinute, gridEndMinute, slotHeight });
  stateRef.current = { blocks, gridStartMinute, gridEndMinute, slotHeight };

  const handleGridMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // Clicks that land on an existing block belong to that block (drag / resize)
      if ((e.target as HTMLElement).closest("[data-block]")) return;
      if (pickerOpen) return;

      const column = columnRef.current;
      if (!column) return;

      const rect = column.getBoundingClientRect();
      const { gridStartMinute: gs, gridEndMinute: ge, slotHeight: sh } =
        stateRef.current;

      const minuteAt = (clientY: number) =>
        pixelToMinute(clientY - rect.top, gs, sh);

      const anchor = Math.min(Math.max(minuteAt(e.clientY), gs), ge - 30);

      // Starting inside an existing block is not a create gesture
      const occupied = stateRef.current.blocks.some((b) =>
        blocksOverlap({ startMinute: anchor, endMinute: anchor + 30 }, b)
      );
      if (occupied) return;

      // A new block may grow until it hits its neighbours or the grid edge
      const lowerBound = stateRef.current.blocks
        .filter((b) => b.endMinute <= anchor)
        .reduce((lo, b) => Math.max(lo, b.endMinute), gs);
      const upperBound = stateRef.current.blocks
        .filter((b) => b.startMinute >= anchor)
        .reduce((hi, b) => Math.min(hi, b.startMinute), ge);

      e.preventDefault();

      // A plain click must do nothing — only an actual drag drafts a block. The
      // threshold measures vertical travel only: this gesture reads time, and a
      // sloppy sideways click should not become a block.
      beginDrag(e, {
        threshold: DRAG_THRESHOLD_PX,
        axis: "y",
        onMove: (ev) => {
          const cursor = minuteAt(ev.clientY);
          let start = Math.min(anchor, cursor);
          let end = Math.max(anchor + 30, cursor);
          start = Math.max(start, lowerBound);
          end = Math.min(end, upperBound);
          if (end - start < 30) end = start + 30;
          setDraft({ startMinute: start, endMinute: end });
        },
        onEnd: (moved) => {
          if (moved) setPickerOpen(true);
        },
        onCancel: () => setDraft(null),
      });
    },
    [beginDrag, pickerOpen]
  );

  const handlePickWorkspace = (workspaceId: string) => {
    if (draft) {
      addBlock(weekOf, date, {
        id: crypto.randomUUID(),
        workspaceId,
        taskIds: [],
        startMinute: draft.startMinute,
        endMinute: draft.endMinute,
      });
    }
    setPickerOpen(false);
    setDraft(null);
  };

  const handlePickerOpenChange = (open: boolean) => {
    setPickerOpen(open);
    if (!open) setDraft(null);
  };

  // Collect full-hour marks for grid lines
  const hourLines: number[] = [];
  for (let m = gridStartMinute; m <= gridEndMinute; m += 30) {
    if (m % 60 === 0) hourLines.push(m);
  }

  return (
    <div
      ref={columnRef}
      className={cn(
        "relative border-r border-border/40 last:border-r-0 min-w-0",
        today && "bg-primary/[0.03]"
      )}
      style={{ height: totalHeight }}
      data-day={date}
      onMouseDown={handleGridMouseDown}
    >
      {/* Hour grid lines */}
      {hourLines.map((minute) => {
        const top = minuteToPixel(minute, gridStartMinute, slotHeight);
        return (
          <div
            key={minute}
            className="absolute left-0 right-0 border-t border-border/20 pointer-events-none"
            style={{ top }}
          />
        );
      })}

      {/* Half-hour grid lines (lighter) */}
      {Array.from({ length: totalSlots }, (_, i) => {
        const minute = gridStartMinute + i * 30;
        if (minute % 60 === 0) return null;
        const top = minuteToPixel(minute, gridStartMinute, slotHeight);
        return (
          <div
            key={`half-${minute}`}
            className="absolute left-0 right-0 border-t border-border/10 pointer-events-none"
            style={{ top }}
          />
        );
      })}

      {/* Workspace blocks — absolutely positioned */}
      {blocks.map((block) => (
        <TimeBlock
          key={block.id}
          block={block}
          day={date}
          weekOf={weekOf}
          allTasks={allTasks}
          workspaces={workspaces}
          gridStartMinute={gridStartMinute}
          slotHeight={slotHeight}
          siblingBlocks={blocks.filter((b) => b.id !== block.id)}
          onDragStart={onBlockDragStart}
          isDropTarget={
            taskDropTarget?.kind === "block" && taskDropTarget.blockId === block.id
          }
        />
      ))}

      {/* Where a task dragged from the rail would land as a new block */}
      {taskDropTarget?.kind === "empty" && (
        <div
          className="absolute left-1 right-1 z-30 pointer-events-none rounded-lg border-2 border-dashed flex items-start px-2 py-1"
          style={{
            top: minuteToPixel(taskDropTarget.startMinute, gridStartMinute, slotHeight),
            height:
              ((taskDropTarget.endMinute - taskDropTarget.startMinute) / 30) * slotHeight,
            borderColor: `color-mix(in srgb, ${taskDropColor || "#64748b"} 60%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${taskDropColor || "#64748b"} 12%, transparent)`,
          }}
        >
          <span className="text-[10px] text-muted-foreground">
            {minutesToTime(taskDropTarget.startMinute)}
          </span>
        </div>
      )}

      {/* Draft range + workspace picker */}
      {draft && (
        <Popover open={pickerOpen} onOpenChange={handlePickerOpenChange}>
          <PopoverAnchor asChild>
            <div
              className="absolute left-1 right-1 z-20 rounded-lg border-2 border-dashed border-primary/50 bg-primary/10 px-2 py-1 pointer-events-none"
              style={{
                top: minuteToPixel(draft.startMinute, gridStartMinute, slotHeight),
                height: ((draft.endMinute - draft.startMinute) / 30) * slotHeight,
              }}
            >
              <span className="text-[10px] text-primary/80 font-medium">
                {minutesToTime(draft.startMinute)} – {minutesToTime(draft.endMinute)}
              </span>
            </div>
          </PopoverAnchor>
          <PopoverContent className="w-44 p-1" align="start">
            <WorkspacePickerList onSelect={handlePickWorkspace} />
          </PopoverContent>
        </Popover>
      )}

      {/* Current-time line — today only */}
      {showNowLine && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ top: minuteToPixel(nowMinute, gridStartMinute, slotHeight) }}
        >
          <div className="relative h-px bg-red-500/70">
            <div className="absolute -left-0.5 -top-[3px] h-[7px] w-[7px] rounded-full bg-red-500" />
          </div>
        </div>
      )}
    </div>
  );
}
