/**
 * WeekView — Day columns with workspace blocks and task assignments
 * Wraps everything in DndContext for drag-drop between pool and blocks
 */

import { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Circle } from "lucide-react";
import { usePlannerStore, useAllWorkspaceTasks } from "@/stores/planner";
import { useWorkspaces } from "@/stores/workspaces";
import { getWeekMonday, getWeekDays } from "@/lib/desk/planner";
import { WeekNavigator } from "./week-navigator";
import { DayColumn } from "./day-column";
import { TasksPool } from "./unscheduled-pool";
import type { ActiveTask } from "@/lib/desk/dashboard";
import type { WorkspaceBlock, Workspace } from "@/types";

export function WeekView() {
  const [currentMonday, setCurrentMonday] = useState(() =>
    getWeekMonday(new Date())
  );
  const weekPlan = usePlannerStore((s) => s.getOrCreateWeekPlan(currentMonday));
  const { data: allTasks = [] } = useAllWorkspaceTasks();
  const { data: workspaces = [] } = useWorkspaces();

  const days = getWeekDays(currentMonday, weekPlan.showWeekends);

  // All tasks are always available in the pool — a task can be planned
  // across multiple days/blocks (e.g. work on it Monday and Tuesday)

  const [poolCollapsed, setPoolCollapsed] = useState(false);
  const [activeDragTask, setActiveDragTask] = useState<ActiveTask | null>(null);
  const [activeDragBlock, setActiveDragBlock] = useState<{
    block: WorkspaceBlock;
    workspace?: Workspace;
  } | null>(null);

  // Drag-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Find which block a task belongs to (for moving between blocks)
  const findTaskBlock = useCallback(
    (taskId: string): { day: string; blockId: string } | null => {
      for (const [day, blocks] of Object.entries(weekPlan.days)) {
        for (const block of blocks) {
          if (block.taskIds.includes(taskId)) {
            return { day, blockId: block.id };
          }
        }
      }
      return null;
    },
    [weekPlan.days]
  );

  // Find which day a block belongs to
  const findBlockDay = useCallback(
    (blockId: string): string | null => {
      for (const [day, blocks] of Object.entries(weekPlan.days)) {
        if (blocks.some((b) => b.id === blockId)) return day;
      }
      return null;
    },
    [weekPlan.days]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);

    if (activeId.startsWith("pool-task:") || activeId.startsWith("task:")) {
      const taskId = activeId.split(":").slice(1).join(":");
      const task = allTasks.find((t) => t.id === taskId);
      if (task) setActiveDragTask(task);
    } else if (activeId.startsWith("block:")) {
      const blockId = activeId.replace("block:", "");
      for (const blocks of Object.values(weekPlan.days)) {
        const block = blocks.find((b) => b.id === blockId);
        if (block) {
          const ws = workspaces.find((w) => w.id === block.workspaceId);
          setActiveDragBlock({ block, workspace: ws });
          break;
        }
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragTask(null);
    setActiveDragBlock(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const store = usePlannerStore.getState();

    // Task dropped onto a block zone
    if (
      (activeId.startsWith("pool-task:") || activeId.startsWith("task:")) &&
      overId.startsWith("blockzone:")
    ) {
      const taskId = activeId.split(":").slice(1).join(":");
      const targetBlockId = overId.replace("blockzone:", "");

      for (const [day, blocks] of Object.entries(weekPlan.days)) {
        const targetBlock = blocks.find((b) => b.id === targetBlockId);
        if (targetBlock) {
          const source = findTaskBlock(taskId);
          if (source) {
            store.moveTask(
              currentMonday,
              source.day,
              source.blockId,
              day,
              targetBlockId,
              taskId
            );
          } else {
            store.addTaskToBlock(currentMonday, day, targetBlockId, taskId);
          }
          break;
        }
      }
      return;
    }

    // Block reordering / moving between days
    if (activeId.startsWith("block:")) {
      const blockId = activeId.replace("block:", "");
      const fromDay = findBlockDay(blockId);
      if (!fromDay) return;

      if (overId.startsWith("block:")) {
        // Dropped on another block — reorder
        const overBlockId = overId.replace("block:", "");
        const toDay = findBlockDay(overBlockId);
        if (!toDay) return;

        if (fromDay === toDay) {
          // Reorder within same day
          const dayBlocks = weekPlan.days[fromDay] || [];
          const oldIndex = dayBlocks.findIndex((b) => b.id === blockId);
          const newIndex = dayBlocks.findIndex((b) => b.id === overBlockId);
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex)
            return;

          const newOrder = [...dayBlocks.map((b) => b.id)];
          newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, blockId);
          store.reorderBlocks(currentMonday, fromDay, newOrder);
        } else {
          // Move to different day at the position of the target block
          const toBlocks = weekPlan.days[toDay] || [];
          const toIndex = toBlocks.findIndex((b) => b.id === overBlockId);
          store.moveBlock(
            currentMonday,
            fromDay,
            toDay,
            blockId,
            toIndex >= 0 ? toIndex : 0
          );
        }
      } else if (overId.startsWith("day:")) {
        // Dropped on a day column — move to end of that day
        const toDay = overId.replace("day:", "");
        if (fromDay === toDay) return;
        const toBlocks = weekPlan.days[toDay] || [];
        store.moveBlock(
          currentMonday,
          fromDay,
          toDay,
          blockId,
          toBlocks.length
        );
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Week navigation header */}
        <div className="shrink-0 border-b border-border/60 h-10 px-4 flex items-center justify-center">
          <WeekNavigator
            currentMonday={currentMonday}
            showWeekends={weekPlan.showWeekends}
            onChange={setCurrentMonday}
          />
        </div>

        {/* Day columns + unscheduled pool */}
        <div className="flex flex-1 min-h-0">
          <div
            className="flex-1 min-w-0 grid"
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
              />
            ))}
          </div>

          <TasksPool
            tasks={allTasks}
            workspaces={workspaces}
            collapsed={poolCollapsed}
            onToggleCollapse={() => setPoolCollapsed((p) => !p)}
            weekOf={currentMonday}
          />
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragTask && (
          <div className="px-2 py-1 rounded bg-card border border-border shadow-lg text-xs font-medium max-w-[200px] truncate">
            {activeDragTask.title}
          </div>
        )}
        {activeDragBlock && (
          <div
            className="px-2 py-1.5 rounded border shadow-lg text-xs font-medium max-w-[180px] flex items-center gap-1.5"
            style={{
              borderColor: `color-mix(in srgb, ${activeDragBlock.workspace?.color || "#64748b"} 40%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${activeDragBlock.workspace?.color || "#64748b"} 8%, var(--color-card))`,
            }}
          >
            <Circle
              className="h-2.5 w-2.5 shrink-0"
              style={{
                color: activeDragBlock.workspace?.color || "#64748b",
                fill: activeDragBlock.workspace?.color || "#64748b",
              }}
            />
            <span className="truncate">
              {activeDragBlock.workspace?.name ||
                activeDragBlock.block.workspaceId}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
