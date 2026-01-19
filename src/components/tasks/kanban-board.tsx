"use client";

import { useState, useCallback, useMemo } from "react";
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
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import {
  useTasks,
  useProjectTasks,
  useMoveTask,
  useCurrentArea,
  useProjects,
  useViewState,
  useUpdateTaskOrder,
  sortTasksByOrder,
} from "@/stores";
import type { Task, TaskStatus } from "@/types";
import { isUnassigned } from "@/lib/orbit/constants";
import { taskStatusColors } from "@/lib/design-tokens";

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

export function KanbanBoard({
  projectId,
  onTaskClick,
  showProject,
  tasks: externalTasks,
  showDoneByDefault = false,
}: KanbanBoardProps) {
  const currentArea = useCurrentArea();
  const currentAreaId = currentArea?.id || null;
  const [showDone, setShowDone] = useState(showDoneByDefault);

  // Use project-specific tasks if projectId provided, otherwise all tasks
  const allTasksQuery = useTasks(projectId ? null : currentAreaId);
  const projectTasksQuery = useProjectTasks(
    projectId ? currentAreaId : null,
    projectId || null
  );
  const { data: projects = [] } = useProjects(currentAreaId);

  // Fetch view state for task ordering
  // - Project view: uses project-level .view.json
  // - All Tasks view: uses area-level .view.json (projectId = null)
  const effectiveProjectId = projectId || null;
  const { data: viewState } = useViewState(currentAreaId, effectiveProjectId);
  const updateTaskOrder = useUpdateTaskOrder();
  const moveTask = useMoveTask();

  // Use external tasks if provided (for filtering), otherwise use query results
  const queryResult = projectId ? projectTasksQuery : allTasksQuery;
  const { data: fetchedTasks = [], isLoading } = queryResult;
  const tasks = externalTasks ?? fetchedTasks;

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<TaskStatus | null>(null);

  // Helper to get project name by ID
  const getProjectName = useCallback(
    (taskProjectId: string) => {
      if (isUnassigned(taskProjectId)) return null;
      const project = projects.find((p) => p.id === taskProjectId);
      return project?.name || taskProjectId;
    },
    [projects]
  );

  // Group and sort tasks by status
  const groupedTasks = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: tasks.filter((t) => t.status === "todo"),
      doing: tasks.filter((t) => t.status === "doing"),
      waiting: tasks.filter((t) => t.status === "waiting"),
      done: tasks.filter((t) => t.status === "done"),
    };

    // Apply custom ordering if we have view state
    // sortTasksByOrder falls back to created date if no order defined
    return {
      todo: sortTasksByOrder(grouped.todo, viewState?.taskOrder?.todo),
      doing: sortTasksByOrder(grouped.doing, viewState?.taskOrder?.doing),
      waiting: sortTasksByOrder(grouped.waiting, viewState?.taskOrder?.waiting),
      done: sortTasksByOrder(grouped.done, viewState?.taskOrder?.done),
    };
  }, [tasks, viewState?.taskOrder]);

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
        setActiveColumn(task.status);
      }
    },
    [tasks]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over) return;

      const overId = over.id as string;

      // Determine which column we're over
      if (
        overId === "todo" ||
        overId === "doing" ||
        overId === "waiting" ||
        overId === "done"
      ) {
        setActiveColumn(overId);
      } else {
        // Over a task - find its status
        const overTask = tasks.find((t) => t.id === overId);
        if (overTask) {
          setActiveColumn(overTask.status);
        }
      }
    },
    [tasks]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);
      setActiveColumn(null);

      if (!over) return;

      const taskId = active.id as string;
      const overId = over.id as string;

      // Find the dragged task
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Determine target status
      let targetStatus: TaskStatus;
      if (
        overId === "todo" ||
        overId === "doing" ||
        overId === "waiting" ||
        overId === "done"
      ) {
        targetStatus = overId;
      } else {
        const overTask = tasks.find((t) => t.id === overId);
        if (!overTask) return;
        targetStatus = overTask.status;
      }

      const statusChanged = task.status !== targetStatus;

      // Need areaId for any operation
      if (!currentAreaId) return;

      // Build new order for all columns (used for both project and All Tasks view)
      const newOrder: Record<TaskStatus, string[]> = {
        todo: groupedTasks.todo.map((t) => t.id),
        doing: groupedTasks.doing.map((t) => t.id),
        waiting: groupedTasks.waiting.map((t) => t.id),
        done: groupedTasks.done.map((t) => t.id),
      };

      if (statusChanged) {
        // Moving to different column
        // Remove from old column
        newOrder[task.status] = newOrder[task.status].filter(
          (id) => id !== taskId
        );

        // Add to new column at the right position
        if (
          overId === "todo" ||
          overId === "doing" ||
          overId === "waiting" ||
          overId === "done"
        ) {
          // Dropped on column itself - add at end
          newOrder[targetStatus].push(taskId);
        } else {
          // Dropped on a task - insert at that position
          const overIndex = newOrder[targetStatus].indexOf(overId);
          if (overIndex >= 0) {
            newOrder[targetStatus].splice(overIndex, 0, taskId);
          } else {
            newOrder[targetStatus].push(taskId);
          }
        }

        // Update status in backend
        moveTask.mutate({
          taskId,
          newStatus: targetStatus,
          areaId: currentAreaId,
          projectId: projectId,
        });
      } else {
        // Same column - just reorder
        if (overId !== taskId) {
          const oldIndex = newOrder[targetStatus].indexOf(taskId);
          const newIndex = newOrder[targetStatus].indexOf(overId);

          if (oldIndex >= 0 && newIndex >= 0) {
            newOrder[targetStatus] = arrayMove(
              newOrder[targetStatus],
              oldIndex,
              newIndex
            );
          }
        }
      }

      // Save the new order (works for both project view and All Tasks)
      // projectId = null for All Tasks -> saves to area-level .view.json
      updateTaskOrder.mutate({
        areaId: currentAreaId,
        projectId: effectiveProjectId,
        taskOrder: newOrder,
      });
    },
    [
      tasks,
      groupedTasks,
      moveTask,
      updateTaskOrder,
      projectId,
      currentAreaId,
      effectiveProjectId,
    ]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">
          Loading tasks...
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-flow-col auto-cols-[300px] gap-4 pb-4 items-stretch">
        <KanbanColumn
          status="todo"
          tasks={groupedTasks.todo}
          onTaskClick={onTaskClick}
          showProject={showProject}
          getProjectName={getProjectName}
          isDropTarget={activeColumn === "todo"}
        />
        <KanbanColumn
          status="doing"
          tasks={groupedTasks.doing}
          onTaskClick={onTaskClick}
          showProject={showProject}
          getProjectName={getProjectName}
          isDropTarget={activeColumn === "doing"}
        />
        <KanbanColumn
          status="waiting"
          tasks={groupedTasks.waiting}
          onTaskClick={onTaskClick}
          showProject={showProject}
          getProjectName={getProjectName}
          isDropTarget={activeColumn === "waiting"}
        />
        {showDone ? (
          <div className="flex flex-col min-w-[300px] w-[300px]">
            <div className="flex items-center gap-2.5 mb-4 px-1">
              <div
                className={`w-2 h-2 rounded-full ${taskStatusColors.done}`}
              />
              <h3 className="font-semibold text-[13px] text-foreground/80">
                Done
              </h3>
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
              isDropTarget={activeColumn === "done"}
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
            <span className="tabular-nums opacity-70">
              {groupedTasks.done.length}
            </span>
          </button>
        )}
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            showProject={showProject}
            projectName={
              showProject ? getProjectName(activeTask.projectId) : undefined
            }
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
