"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { useTasks, useProjectTasks, useMoveTask, groupTasksByStatus } from "@/stores";
import { useSettingsStore } from "@/stores/settings";
import type { Task, TaskStatus } from "@/types";

interface KanbanBoardProps {
  projectId?: string;
  onTaskClick?: (task: Task) => void;
}

export function KanbanBoard({ projectId, onTaskClick }: KanbanBoardProps) {
  const currentAreaId = useSettingsStore((state) => state.currentAreaId);

  // Use project-specific tasks if projectId provided, otherwise all tasks
  const allTasksQuery = useTasks(projectId ? null : currentAreaId);
  const projectTasksQuery = useProjectTasks(projectId ? currentAreaId : null, projectId || null);

  const { data: tasks = [], isLoading } = projectId ? projectTasksQuery : allTasksQuery;
  const moveTask = useMoveTask();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      if (task) {
        setActiveTask(task);
      }
    },
    [tasks]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) return;

      const taskId = active.id as string;
      const overId = over.id as string;

      // Find the dragged task
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Determine new status - could be dropping on a column or another task
      let newStatus: TaskStatus;
      if (overId === "todo" || overId === "doing" || overId === "done") {
        // Dropped on a column
        newStatus = overId;
      } else {
        // Dropped on another task - find that task's status
        const overTask = tasks.find((t) => t.id === overId);
        if (!overTask) return;
        newStatus = overTask.status;
      }

      // Only update if status changed
      if (task.status !== newStatus) {
        moveTask.mutate({ taskId, newStatus });
      }
    },
    [tasks, moveTask]
  );

  const groupedTasks = groupTasksByStatus(tasks);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-full">
        <KanbanColumn
          status="todo"
          tasks={groupedTasks.todo}
          onTaskClick={onTaskClick}
        />
        <KanbanColumn
          status="doing"
          tasks={groupedTasks.doing}
          onTaskClick={onTaskClick}
        />
        <KanbanColumn
          status="done"
          tasks={groupedTasks.done}
          onTaskClick={onTaskClick}
        />
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
