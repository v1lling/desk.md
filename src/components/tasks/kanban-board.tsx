
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
import { useTranslation } from "react-i18next";
import { taskStatusOrder } from "@/lib/design-tokens";
import {
  useTasks,
  useProjectTasks,
  useMoveTask,
  useCurrentWorkspace,
  useViewState,
  useUpdateTaskOrder,
  useHighlightedTasks,
  sortTasksByOrder,
} from "@/stores";
import { useProjectName } from "@/hooks";
import type { Task, TaskStatus } from "@/types";
import { LoadingState } from "@/components/ui/loading-state";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KanbanBoardProps {
  projectId?: string;
  onTaskClick?: (task: Task) => void;
  /** When true, shows project name on task cards (used on All Tasks page) */
  showProject?: boolean;
  /** Optional pre-filtered tasks to display instead of fetching all */
  tasks?: Task[];
  /** Statuses hidden from the board (kanban columns) */
  hiddenStatuses: Set<TaskStatus>;
  /** Loading state (used when tasks are passed externally) */
  isLoading?: boolean;
}

export function KanbanBoard({
  projectId,
  onTaskClick,
  showProject,
  tasks: externalTasks,
  hiddenStatuses,
  isLoading: externalIsLoading,
}: KanbanBoardProps) {
  const { t } = useTranslation();
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;

  // Use project-specific tasks if projectId provided, otherwise all tasks
  const allTasksQuery = useTasks(projectId ? null : currentWorkspaceId);
  const projectTasksQuery = useProjectTasks(
    projectId ? currentWorkspaceId : null,
    projectId || null
  );
  const { getProjectName } = useProjectName(currentWorkspaceId);

  // Fetch view state for task ordering
  // - Project view: uses project-level .view.json
  // - All Tasks view: uses workspace-level .view.json (projectId = null)
  const effectiveProjectId = projectId || null;
  const { data: viewState } = useViewState(
    currentWorkspaceId,
    effectiveProjectId
  );
  const { highlightedTasks, toggleHighlight } = useHighlightedTasks(
    currentWorkspaceId,
    effectiveProjectId
  );
  const updateTaskOrder = useUpdateTaskOrder();
  const moveTask = useMoveTask();

  // Use external tasks if provided (for filtering), otherwise use query results
  const queryResult = projectId ? projectTasksQuery : allTasksQuery;
  const { data: fetchedTasks = [], isLoading: queryIsLoading } = queryResult;
  const tasks = externalTasks ?? fetchedTasks;
  const isLoading = externalIsLoading ?? queryIsLoading;

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<TaskStatus | null>(null);

  // Group and sort tasks by status
  const groupedTasks = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      backlog: tasks.filter((t) => t.status === "backlog"),
      todo: tasks.filter((t) => t.status === "todo"),
      doing: tasks.filter((t) => t.status === "doing"),
      waiting: tasks.filter((t) => t.status === "waiting"),
      done: tasks.filter((t) => t.status === "done"),
    };

    // Apply custom ordering if we have view state
    // sortTasksByOrder falls back to created date if no order defined
    return {
      backlog: sortTasksByOrder(grouped.backlog, viewState?.taskOrder?.backlog),
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
        overId === "backlog" ||
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
        overId === "backlog" ||
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

      // Need workspaceId for workspace operations
      if (!currentWorkspaceId) return;

      // Build new order for all columns (used for both project and All Tasks view)
      const newOrder: Record<TaskStatus, string[]> = {
        backlog: groupedTasks.backlog.map((t) => t.id),
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
          overId === "backlog" ||
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
          workspaceId: currentWorkspaceId,
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
      // projectId = null for All Tasks -> saves to workspace-level .view.json
      updateTaskOrder.mutate({
        workspaceId: currentWorkspaceId,
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
      currentWorkspaceId,
      effectiveProjectId,
    ]
  );

  if (isLoading) {
    return <LoadingState label={t("entities.task.pluralLowercase")} />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea orientation="horizontal" horizontalScrollbarPosition="top">
        <div className="grid grid-flow-col auto-cols-[280px] gap-3 items-stretch pt-3">
          {taskStatusOrder.map((status) =>
            hiddenStatuses.has(status) ? null : (
              <KanbanColumn
                key={status}
                status={status}
                tasks={groupedTasks[status]}
                onTaskClick={onTaskClick}
                showProject={showProject}
                getProjectName={getProjectName}
                isDropTarget={activeColumn === status}
                highlightedTasks={highlightedTasks}
                onToggleHighlight={toggleHighlight}
                workspaceColor={currentWorkspace?.color}
              />
            ),
          )}
        </div>
      </ScrollArea>
      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            showProject={showProject}
            projectName={
              showProject ? getProjectName(activeTask.projectId) : undefined
            }
            isHighlighted={highlightedTasks.has(activeTask.id)}
            workspaceColor={currentWorkspace?.color}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
