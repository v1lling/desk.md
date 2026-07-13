/**
 * WeekView — Time-based week schedule with day columns and time axis.
 * Blocks are positioned by time. Drag and resize use native mouse events.
 * Slot height is computed dynamically to fit the available container.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { parseISO, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlannerStore, useAllWorkspaceTasksAllStatuses } from "@/stores/planner";
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
  pixelsToMinutes,
  snapToSlot,
  blocksOverlap,
} from "@desk/core";
import { WeekNavigator } from "./week-navigator";
import { TimeGrid } from "./time-grid";
import { DayColumn } from "./day-column";
import { AddBlockButton } from "./add-block-popover";
import { DueStrip } from "./due-strip";
import { WeekIntentions } from "./week-intentions";
import { UnscheduledRail } from "./unscheduled-rail";
import { usePointerDrag } from "./use-pointer-drag";
import { useTaskDrag } from "./use-task-drag";
import { dayAtClientX, getPlannerViewport } from "./grid-hit-test";
import type { WorkspaceBlock } from "@desk/core/types";
import type { ActiveTask } from "@desk/core";

/** Stable empty references — a week with no plan must not allocate on every render. */
const NO_DAYS: Record<string, WorkspaceBlock[]> = {};
const NO_BLOCKS: WorkspaceBlock[] = [];
const NO_INTENTIONS: string[] = [];
const NO_TASKS: ActiveTask[] = [];

/** Minutes from midnight, re-read once a minute, for the "now" indicator. */
function currentMinute(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function useCurrentMinute(): number {
  const [minute, setMinute] = useState(currentMinute);
  useEffect(() => {
    const id = setInterval(() => setMinute(currentMinute()), 60_000);
    return () => clearInterval(id);
  }, []);
  return minute;
}

export function WeekView() {
  const [currentMonday, setCurrentMonday] = useState(() =>
    getWeekMonday(new Date())
  );
  // Read-only selector: a week plan is created lazily by the first write, so
  // merely paging through empty weeks must not persist empty plans.
  const dayBlocks = usePlannerStore(
    (s) => s.weekPlans[currentMonday]?.days ?? NO_DAYS
  );
  const moveBlock = usePlannerStore((s) => s.moveBlock);
  const updateBlockTime = usePlannerStore((s) => s.updateBlockTime);
  const setIntention = usePlannerStore((s) => s.setIntention);
  // Same lazy-write rule as dayBlocks: reading an empty week must persist nothing.
  const intentions = usePlannerStore(
    (s) => s.weekPlans[currentMonday]?.intentions ?? NO_INTENTIONS
  );
  // Every week's blocks, to decide what is already scheduled (see `unscheduled`).
  const weekPlans = usePlannerStore((s) => s.weekPlans);
  // All statuses: a task finished after it was planned must stay visible in its
  // block (struck through) rather than silently vanishing from the week.
  const { data: allTasks = [] } = useAllWorkspaceTasksAllStatuses();
  const { data: workspaces = [] } = useWorkspaces();
  const nowMinute = useCurrentMinute();

  const workDayStartHour = usePreferencesStore((s) => s.workDayStartHour);
  const workDayEndHour = usePreferencesStore((s) => s.workDayEndHour);
  const showWeekends = usePreferencesStore((s) => s.showWeekends);

  const days = getWeekDays(currentMonday, showWeekends);

  // ── The rail's set ────────────────────────────────────────────────
  // Scheduled = planned in *this real week or later*, not merely in the week on screen.
  // Cutting at the displayed week would show a task planned for next Tuesday as
  // unplanned whenever you paged back (so you would schedule it twice); cutting at
  // "any week ever" would bury a task in a stale past block and never offer it again.
  const scheduledTaskIds = useMemo(() => {
    const thisMonday = getWeekMonday(new Date());
    const scheduled = new Set<string>();
    for (const plan of Object.values(weekPlans)) {
      if (plan.weekOf < thisMonday) continue;
      for (const blocks of Object.values(plan.days)) {
        for (const block of blocks) {
          for (const taskId of block.taskIds) scheduled.add(taskId);
        }
      }
    }
    return scheduled;
  }, [weekPlans]);

  // Backlog is deliberately absent: it means "not committed", and the planner is for
  // committed work. Without that filter the rail becomes an unbounded dump.
  const unscheduledTasks = useMemo(
    () =>
      allTasks.filter(
        (task) =>
          task.status !== "done" &&
          task.status !== "backlog" &&
          !scheduledTaskIds.has(task.id)
      ),
    [allTasks, scheduledTaskIds]
  );

  // Tasks due on each day of the week — including ones not planned that day.
  const dueByDay = useMemo(() => {
    const map: Record<string, ActiveTask[]> = {};
    for (const task of allTasks) {
      if (!task.due || task.status === "done") continue;
      (map[task.due] ??= []).push(task);
    }
    return map;
  }, [allTasks]);

  // Collect all blocks across all days for grid range calculation
  const allBlocks = useMemo(() => {
    const blocks: { startMinute: number; endMinute: number }[] = [];
    for (const blocksOfDay of Object.values(dayBlocks)) {
      for (const b of blocksOfDay) {
        blocks.push({ startMinute: b.startMinute, endMinute: b.endMinute });
      }
    }
    return blocks;
  }, [dayBlocks]);

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

  // ── Dragging a task out of the rail ───────────────────────────────
  const {
    startTaskDrag,
    dragTask,
    ghost,
    target: taskDropTarget,
  } = useTaskDrag({
    weekOf: currentMonday,
    dayBlocks,
    gridStartMinute,
    gridEndMinute,
    slotHeight,
  });

  // ── Scroll to work day start on mount / week change ──────────────
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (!hasScrolled.current && containerHeight > 0) {
      // OverlayScrollbars may not be ready immediately — poll briefly
      const id = setInterval(() => {
        const viewport = getPlannerViewport();
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

  const beginDrag = usePointerDrag();

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
  const dayBlocksRef = useRef(dayBlocks);
  dayBlocksRef.current = dayBlocks;
  const daysRef = useRef(days);
  daysRef.current = days;

  const handleBlockDragStart = useCallback(
    (blockId: string, fromDay: string, e: React.MouseEvent) => {
      const block = dayBlocksRef.current[fromDay]?.find(
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

      beginDrag(e, {
        cursor: "grabbing",
        onMove: (ev) => {
          if (!dragRef.current) return;

          const deltaY = ev.clientY - dragRef.current.startY;
          let newStart = snapToSlot(
            dragRef.current.originalStartMinute +
              pixelsToMinutes(deltaY, slotHeightRef.current)
          );

          // Clamp to grid bounds
          if (newStart < 0) newStart = 0;
          if (newStart + duration > 1440) newStart = 1440 - duration;

          // Which column is the cursor over? Rect-scan, not elementFromPoint — the
          // block being dragged sits under the cursor and would win the hit-test.
          const targetDay = dayAtClientX(ev.clientX) ?? dragRef.current.fromDay;

          // Check overlap with blocks in target day
          const targetBlocks = dayBlocksRef.current[targetDay] || [];
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
        },
        onEnd: () => {
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
        },
        onCancel: () => {
          dragRef.current = null;
          setDragPreview(null);
        },
      });
    },
    [beginDrag, currentMonday, moveBlock, updateBlockTime]
  );

  return (
    <div className="flex flex-1 min-h-0">
      {/* Grid column — the rail lives outside it, and outside gridContainerRef, so it
          cannot perturb the ResizeObserver that sizes the slots. */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        {/* Week navigation header */}
        <div className="shrink-0 border-b border-border/60 h-10 px-4 flex items-center justify-center">
          <WeekNavigator
            currentMonday={currentMonday}
            showWeekends={showWeekends}
            onChange={setCurrentMonday}
          />
        </div>

        <WeekIntentions
          intentions={intentions}
          onChange={(index, text) => setIntention(currentMonday, index, text)}
        />

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
                  <DueStrip tasks={dueByDay[day] ?? NO_TASKS} />
                  {/* Add block button */}
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <AddBlockButton
                      date={day}
                      weekOf={currentMonday}
                      blocks={dayBlocks[day] ?? NO_BLOCKS}
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
                    blocks={dayBlocks[day] ?? NO_BLOCKS}
                    allTasks={allTasks}
                    workspaces={workspaces}
                    gridStartMinute={gridStartMinute}
                    gridEndMinute={gridEndMinute}
                    slotHeight={slotHeight}
                    nowMinute={nowMinute}
                    onBlockDragStart={handleBlockDragStart}
                    taskDropTarget={
                      taskDropTarget?.day === day ? taskDropTarget : undefined
                    }
                    taskDropColor={dragTask?.workspaceColor}
                  />
                ))}

                {/* Drag preview ghost — inside grid so it scrolls with content */}
                {dragPreview && dragPreview.dayIndex >= 0 && (() => {
                  const block = Object.values(dayBlocks)
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

      <UnscheduledRail
        tasks={unscheduledTasks}
        days={days}
        onTaskMouseDown={startTaskDrag}
        draggingTaskId={dragTask?.id}
      />

      {/* Cursor ghost. pointer-events-none is load-bearing: blockAtPoint() uses
          elementFromPoint, and a ghost under the cursor would win every hit-test. */}
      {dragTask && ghost && (
        <div
          className="fixed z-50 pointer-events-none flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card shadow-md text-xs max-w-[14rem]"
          style={{ left: ghost.x + 12, top: ghost.y + 12 }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: dragTask.workspaceColor || "#64748b" }}
          />
          <span className="truncate">{dragTask.title}</span>
        </div>
      )}
    </div>
  );
}
