/**
 * DayColumn — A single day in the time-based week view.
 * Blocks are absolutely positioned by their start/end time.
 * Horizontal grid lines mark each hour.
 */

import { useRef } from "react";
import { minuteToPixel } from "@/lib/desk/planner";
import { TimeBlock } from "./workspace-block";
import type { WorkspaceBlock, Workspace } from "@/types";
import type { ActiveTask } from "@/lib/desk/dashboard";

interface DayColumnProps {
  date: string;
  weekOf: string;
  blocks: WorkspaceBlock[];
  allTasks: ActiveTask[];
  workspaces: Workspace[];
  gridStartMinute: number;
  gridEndMinute: number;
  slotHeight: number;
  onBlockDragStart?: (blockId: string, day: string, e: React.MouseEvent) => void;
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
  onBlockDragStart,
}: DayColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const totalSlots = (gridEndMinute - gridStartMinute) / 30;
  const totalHeight = totalSlots * slotHeight;

  // Collect full-hour marks for grid lines
  const hourLines: number[] = [];
  for (let m = gridStartMinute; m <= gridEndMinute; m += 30) {
    if (m % 60 === 0) hourLines.push(m);
  }

  return (
    <div
      ref={columnRef}
      className="relative border-r border-border/40 last:border-r-0 min-w-0"
      style={{ height: totalHeight }}
      data-day={date}
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
    </div>
  );
}
