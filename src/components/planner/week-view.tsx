/**
 * WeekView — Time-based week schedule with day columns and time axis.
 * Blocks are positioned by time. Drag and resize use native mouse events.
 * Slot height is computed dynamically to fit the available container.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { parseISO, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlannerStore, useAllWorkspaceTasks } from "@/stores/planner";
import { usePreferencesStore } from "@/stores/preferences";
import { useWorkspaces } from "@/stores/workspaces";
import {
  getWeekMonday,
  getWeekDays,
  formatDayName,
  formatDayNumber,
  computeGridRange,
  SLOT_HEIGHT,
  MIN_SLOT_HEIGHT,
  minuteToPixel,
  snapToSlot,
  blocksOverlap,
} from "@/lib/desk/planner";
import { WeekNavigator } from "./week-navigator";
import { TimeGrid } from "./time-grid";
import { DayColumn } from "./day-column";
import { AddBlockButton } from "./add-block-popover";

export function WeekView() {
  const [currentMonday, setCurrentMonday] = useState(() =>
    getWeekMonday(new Date())
  );
  const weekPlan = usePlannerStore((s) => s.getOrCreateWeekPlan(currentMonday));
  const moveBlock = usePlannerStore((s) => s.moveBlock);
  const updateBlockTime = usePlannerStore((s) => s.updateBlockTime);
  const { data: allTasks = [] } = useAllWorkspaceTasks();
  const { data: workspaces = [] } = useWorkspaces();

  const workDayStartHour = usePreferencesStore((s) => s.workDayStartHour);
  const workDayEndHour = usePreferencesStore((s) => s.workDayEndHour);
  const showWeekends = usePreferencesStore((s) => s.showWeekends);

  const days = getWeekDays(currentMonday, showWeekends);

  // Collect all blocks across all days for grid range calculation
  const allBlocks = useMemo(() => {
    const blocks: { startMinute: number; endMinute: number }[] = [];
    for (const dayBlocks of Object.values(weekPlan.days)) {
      for (const b of dayBlocks) {
        blocks.push({ startMinute: b.startMinute, endMinute: b.endMinute });
      }
    }
    return blocks;
  }, [weekPlan.days]);

  const { startMinute: gridStartMinute, endMinute: gridEndMinute } =
    computeGridRange(allBlocks, workDayStartHour * 60, workDayEndHour * 60);

  // ── Dynamic slot height ──────────────────────────────────────────
  // Slot height is computed so that work-day hours fit the visible container.
  // The full grid extends beyond work hours (early morning / late night),
  // which is reachable by scrolling.
  const [containerHeight, setContainerHeight] = useState(0);

  const gridContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Work day slots + 1 slot padding on each side (30min top + 30min bottom)
  const workDaySlots = (workDayEndHour - workDayStartHour) * 2 + 2;
  const slotHeight =
    containerHeight > 0
      ? Math.max(MIN_SLOT_HEIGHT, containerHeight / workDaySlots)
      : SLOT_HEIGHT;

  // Ref for drag handler (avoids stale closure)
  const slotHeightRef = useRef(slotHeight);
  slotHeightRef.current = slotHeight;

  // ── Scroll to work day start on mount / week change ──────────────
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (!hasScrolled.current && containerHeight > 0) {
      // OverlayScrollbars may not be ready immediately — poll briefly
      const id = setInterval(() => {
        const wrapper = document.querySelector("[data-planner-scroll]");
        const viewport = wrapper?.querySelector(
          "[data-overlayscrollbars-viewport]"
        );
        if (viewport) {
          const workStartOffset = minuteToPixel(
            workDayStartHour * 60,
            gridStartMinute,
            slotHeight
          );
          viewport.scrollTop = Math.max(0, workStartOffset - slotHeight);
          hasScrolled.current = true;
          clearInterval(id);
        }
      }, 50);
      // Give up after 1s
      const timeout = setTimeout(() => clearInterval(id), 1000);
      return () => {
        clearInterval(id);
        clearTimeout(timeout);
      };
    }
  }, [gridStartMinute, workDayStartHour, containerHeight, slotHeight]);

  // Reset scroll flag when switching weeks
  useEffect(() => {
    hasScrolled.current = false;
  }, [currentMonday]);

  // ── Cross-day drag handling ────────────────────────────────────────

  // Cleanup ref for drag listeners — prevents memory leak on unmount
  const dragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanupRef.current?.(), []);

  const dragRef = useRef<{
    blockId: string;
    fromDay: string;
    startY: number;
    originalStartMinute: number;
    duration: number;
    currentDay: string;
    currentStartMinute: number;
  } | null>(null);

  const [dragPreview, setDragPreview] = useState<{
    blockId: string;
    day: string;
    dayIndex: number;
    startMinute: number;
    endMinute: number;
  } | null>(null);

  // Keep refs current for mousemove handler (avoids stale closures)
  const weekPlanRef = useRef(weekPlan);
  weekPlanRef.current = weekPlan;
  const daysRef = useRef(days);
  daysRef.current = days;

  const handleBlockDragStart = useCallback(
    (blockId: string, fromDay: string, e: React.MouseEvent) => {
      // Clean up any in-progress drag before starting a new one
      dragCleanupRef.current?.();

      const block = weekPlanRef.current.days[fromDay]?.find(
        (b) => b.id === blockId
      );
      if (!block) return;

      const duration = block.endMinute - block.startMinute;

      dragRef.current = {
        blockId,
        fromDay,
        startY: e.clientY,
        originalStartMinute: block.startMinute,
        duration,
        currentDay: fromDay,
        currentStartMinute: block.startMinute,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;

        const deltaY = ev.clientY - dragRef.current.startY;
        const deltaMinutes = (deltaY / slotHeightRef.current) * 30;
        let newStart = snapToSlot(
          dragRef.current.originalStartMinute + deltaMinutes
        );

        // Clamp to grid bounds
        if (newStart < 0) newStart = 0;
        if (newStart + duration > 1440) newStart = 1440 - duration;

        // Detect which day column the mouse is over
        const dayElements =
          document.querySelectorAll<HTMLElement>("[data-day]");
        let targetDay = dragRef.current.fromDay;
        for (const el of dayElements) {
          const rect = el.getBoundingClientRect();
          if (ev.clientX >= rect.left && ev.clientX <= rect.right) {
            targetDay = el.dataset.day!;
            break;
          }
        }

        // Check overlap with blocks in target day
        const targetBlocks = weekPlanRef.current.days[targetDay] || [];
        const siblings = targetBlocks.filter(
          (b) => b.id !== dragRef.current!.blockId
        );
        const wouldOverlap = siblings.some((s) =>
          blocksOverlap(
            { startMinute: newStart, endMinute: newStart + duration },
            s
          )
        );

        if (!wouldOverlap) {
          dragRef.current.currentDay = targetDay;
          dragRef.current.currentStartMinute = newStart;
          setDragPreview({
            blockId,
            day: targetDay,
            dayIndex: daysRef.current.indexOf(targetDay),
            startMinute: newStart,
            endMinute: newStart + duration,
          });
        }
      };

      const cleanup = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        dragCleanupRef.current = null;
      };

      const handleMouseUp = () => {
        cleanup();

        if (dragRef.current) {
          const {
            fromDay: fd,
            currentDay: td,
            blockId: bid,
            currentStartMinute,
            originalStartMinute,
          } = dragRef.current;
          if (fd !== td) {
            moveBlock(currentMonday, fd, td, bid, currentStartMinute);
          } else if (currentStartMinute !== originalStartMinute) {
            updateBlockTime(
              currentMonday,
              td,
              bid,
              currentStartMinute,
              currentStartMinute + duration
            );
          }
        }

        dragRef.current = null;
        setDragPreview(null);
      };

      dragCleanupRef.current = cleanup;
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [currentMonday, moveBlock, updateBlockTime]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Week navigation header */}
      <div className="shrink-0 border-b border-border/60 h-10 px-4 flex items-center justify-center">
        <WeekNavigator
          currentMonday={currentMonday}
          showWeekends={showWeekends}
          onChange={setCurrentMonday}
        />
      </div>

      {/* Day column headers (sticky above scroll) */}
      <div className="shrink-0 flex border-b border-border/40">
        {/* Spacer for time axis */}
        <div className="shrink-0 w-12" />
        {/* Day name headers */}
        <div
          className="flex-1 grid"
          style={{
            gridTemplateColumns: `repeat(${days.length}, 1fr)`,
          }}
        >
          {days.map((day) => {
            const today = isToday(parseISO(day));
            return (
              <div
                key={day}
                className={cn(
                  "px-3 py-1.5 text-center border-r border-border/40 last:border-r-0 relative group/day-header",
                  today && "bg-primary/5"
                )}
              >
                <div
                  className={cn(
                    "text-[11px] uppercase tracking-wide",
                    today
                      ? "text-primary font-semibold"
                      : "text-muted-foreground"
                  )}
                >
                  {formatDayName(day)}
                </div>
                <div
                  className={cn(
                    "text-sm font-medium",
                    today ? "text-primary" : "text-foreground/80"
                  )}
                >
                  {formatDayNumber(day)}
                </div>
                {/* Add block button */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <AddBlockButton
                    date={day}
                    weekOf={currentMonday}
                    blocks={weekPlan.days[day] || []}
                    compact
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable time grid + day columns */}
      <div ref={gridContainerRef} data-planner-scroll className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="flex">
            {/* Time axis labels */}
            <TimeGrid
              gridStartMinute={gridStartMinute}
              gridEndMinute={gridEndMinute}
              slotHeight={slotHeight}
            />

            {/* Day columns grid */}
            <div
              className="flex-1 grid relative"
              style={{
                gridTemplateColumns: `repeat(${days.length}, 1fr)`,
              }}
            >
              {days.map((day) => (
                <DayColumn
                  key={day}
                  date={day}
                  weekOf={currentMonday}
                  blocks={weekPlan.days[day] || []}
                  allTasks={allTasks}
                  workspaces={workspaces}
                  gridStartMinute={gridStartMinute}
                  gridEndMinute={gridEndMinute}
                  slotHeight={slotHeight}
                  onBlockDragStart={handleBlockDragStart}
                />
              ))}

              {/* Drag preview ghost — inside grid so it scrolls with content */}
              {dragPreview && dragPreview.dayIndex >= 0 && (() => {
                const block = Object.values(weekPlan.days)
                  .flat()
                  .find((b) => b.id === dragPreview.blockId);
                const ws = block ? workspaces.find((w) => w.id === block.workspaceId) : null;
                const ghostColor = ws?.color || "#64748b";
                return (
                  <div
                    className="absolute pointer-events-none z-30 rounded-lg border-2 border-dashed mx-1"
                    style={{
                      gridColumn: dragPreview.dayIndex + 1,
                      top: minuteToPixel(dragPreview.startMinute, gridStartMinute, slotHeight),
                      height: ((dragPreview.endMinute - dragPreview.startMinute) / 30) * slotHeight,
                      borderColor: `color-mix(in srgb, ${ghostColor} 60%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${ghostColor} 12%, transparent)`,
                    }}
                  />
                );
              })()}
            </div>
          </div>
        </ScrollArea>
      </div>

    </div>
  );
}
