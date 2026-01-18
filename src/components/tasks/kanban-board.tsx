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
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useTasks, useProjectTasks, useMoveTask, groupTasksByStatus, useCurrentArea, useProjects } from "@/stores";
import type { Task, TaskStatus } from "@/types";

interface KanbanBoardProps {
  projectId?: string;
  onTaskClick?: (task: Task) => void;
  /** When true, shows project name on task cards (used on All Tasks page) */
  showProject?: boolean;
  /** Optional pre-filtered tasks to display instead of fetching all */
  tasks?: Task[];
  /** Whether to show the Done column by default (default: false) */
  showDoneByDefault?: boolean;
}

export function KanbanBoard({ projectId, onTaskClick, showProject, tasks: externalTasks, showDoneByDefault = false }: KanbanBoardProps) {
  const currentArea = useCurrentArea();
  const currentAreaId = currentArea?.id || null;
  const [showDone, setShowDone] = useState(showDoneByDefault);

  // Use project-specific tasks if projectId provided, otherwise all tasks
  const allTasksQuery = useTasks(projectId ? null : currentAreaId);
  const projectTasksQuery = useProjectTasks(projectId ? currentAreaId : null, projectId || null);
  const { data: projects = [] } = useProjects(currentAreaId);

  // Use external tasks if provided (for filtering), otherwise use query results
  const queryResult = projectId ? projectTasksQuery : allTasksQuery;
  const { data: fetchedTasks = [], isLoading } = queryResult;
  const tasks = externalTasks ?? fetchedTasks;

  const moveTask = useMoveTask();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Helper to get project name by ID
  const getProjectName = useCallback(
    (taskProjectId: string) => {
      const project = projects.find((p) => p.id === taskProjectId);
      return project?.name || taskProjectId;
    },
    [projects]
  );

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
      if (overId === "todo" || overId === "doing" || overId === "waiting" || overId === "done") {
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
          showProject={showProject}
          getProjectName={getProjectName}
        />
        <KanbanColumn
          status="doing"
          tasks={groupedTasks.doing}
          onTaskClick={onTaskClick}
          showProject={showProject}
          getProjectName={getProjectName}
        />
        <KanbanColumn
          status="waiting"
          tasks={groupedTasks.waiting}
          onTaskClick={onTaskClick}
          showProject={showProject}
          getProjectName={getProjectName}
        />
        {showDone ? (
          <div className="flex flex-col h-full min-w-[300px] w-[300px]">
            <div className="flex items-center gap-2.5 mb-4 px-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className="font-semibold text-[13px] text-foreground/80">Done</h3>
              <span className="text-[11px] text-muted-foreground tabular-nums font-medium">
                {groupedTasks.done.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setShowDone(false)}
                title="Hide Done column"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </Button>
            </div>
            <KanbanColumn
              status="done"
              tasks={groupedTasks.done}
              onTaskClick={onTaskClick}
              showProject={showProject}
              getProjectName={getProjectName}
              hideHeader
            />
          </div>
        ) : (
          <button
            onClick={() => setShowDone(true)}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors text-[12px] font-medium self-start mt-0.5"
            title="Show Done column"
          >
            <Eye className="h-3 w-3" />
            <span>Done</span>
            <span className="tabular-nums opacity-70">{groupedTasks.done.length}</span>
          </button>
        )}
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            showProject={showProject}
            projectName={showProject ? getProjectName(activeTask.projectId) : undefined}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
