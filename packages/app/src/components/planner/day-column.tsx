/**
 * DayColumn — A single day in the time-based week view.
 * Blocks are absolutely positioned by their start/end time.
 * Horizontal grid lines mark each hour. Dragging empty space drafts a new block,
 * which is committed once a workspace is picked.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { usePlannerStore } from "@/stores/planner";
import { minuteToPixel, minutesToTime, snapToSlot, blocksOverlap } from "@desk/core";
import { TimeBlock } from "./workspace-block";
import { WorkspacePickerList } from "./add-block-popover";
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
}

/** Draft range being dragged out on empty grid, before a workspace is chosen */
interface DraftRange {
  startMinute: number;
  endMinute: number;
}

/** Vertical travel before a mousedown counts as a drag rather than a stray click */
const DRAG_THRESHOLD_PX = 4;

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

  const createCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => createCleanupRef.current?.(), []);

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
        snapToSlot(gs + ((clientY - rect.top) / sh) * 30);

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

      // A plain click must do nothing — only an actual drag drafts a block.
      let dragging = false;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragging) {
          if (Math.abs(ev.clientY - e.clientY) < DRAG_THRESHOLD_PX) return;
          dragging = true;
        }

        const cursor = minuteAt(ev.clientY);
        let start = Math.min(anchor, cursor);
        let end = Math.max(anchor + 30, cursor);
        start = Math.max(start, lowerBound);
        end = Math.min(end, upperBound);
        if (end - start < 30) end = start + 30;
        setDraft({ startMinute: start, endMinute: end });
      };

      const cleanup = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.userSelect = "";
        createCleanupRef.current = null;
      };

      const handleMouseUp = () => {
        cleanup();
        if (dragging) setPickerOpen(true);
      };

      createCleanupRef.current = cleanup;
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [pickerOpen]
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
        />
      ))}

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
