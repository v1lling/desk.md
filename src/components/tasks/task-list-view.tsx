"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock, Loader2, Flag, FolderKanban, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  priorityTextColors,
  taskStatusTextColors,
  taskStatusLabels,
  taskStatusOrder,
} from "@/lib/design-tokens";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import type { Task, TaskStatus, TaskPriority } from "@/types";

interface TaskListViewProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  /** Show project name on tasks */
  showProject?: boolean;
  /** Get project name by ID */
  getProjectName?: (projectId: string) => string | null;
  /** Group tasks by status (default: true) */
  groupByStatus?: boolean;
  isLoading?: boolean;
}

/** Icon mapping for task statuses */
const statusIcons = {
  todo: Circle,
  doing: Loader2,
  waiting: Clock,
  done: CheckCircle2,
} as const;

/**
 * List view for tasks - alternative to KanbanBoard
 * Shows tasks grouped by status in a vertical list
 */
export function TaskListView({
  tasks,
  onTaskClick,
  showProject,
  getProjectName,
  groupByStatus = true,
  isLoading,
}: TaskListViewProps) {
  // Track which status sections are collapsed
  const [collapsedSections, setCollapsedSections] = useState<Set<TaskStatus>>(new Set());

  const toggleSection = (status: TaskStatus) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  // Group tasks by status
  const groupedTasks = useMemo(() => {
    if (!groupByStatus) {
      return { all: tasks };
    }
    return {
      todo: tasks.filter((t) => t.status === "todo"),
      doing: tasks.filter((t) => t.status === "doing"),
      waiting: tasks.filter((t) => t.status === "waiting"),
      done: tasks.filter((t) => t.status === "done"),
    };
  }, [tasks, groupByStatus]);

  if (isLoading) {
    return <LoadingState label="tasks" />;
  }

  if (tasks.length === 0) {
    return <EmptyState title="No tasks found" />;
  }

  if (!groupByStatus) {
    return (
      <div className="space-y-2 max-w-3xl">
        {tasks.map((task) => (
          <TaskListItem
            key={task.id}
            task={task}
            onClick={onTaskClick}
            showProject={showProject}
            getProjectName={getProjectName}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {taskStatusOrder.map((status) => {
        const statusTasks = groupedTasks[status as keyof typeof groupedTasks] || [];
        if (statusTasks.length === 0) return null;

        const Icon = statusIcons[status];
        const isCollapsed = collapsedSections.has(status);

        return (
          <div key={status}>
            {/* Collapsible status header */}
            <button
              onClick={() => toggleSection(status)}
              className="flex items-center gap-2 mb-3 w-full text-left group"
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  !isCollapsed && "rotate-90"
                )}
              />
              <Icon className={cn("h-4 w-4", taskStatusTextColors[status])} />
              <h3 className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {taskStatusLabels[status]}
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {statusTasks.length}
              </span>
            </button>

            {/* Tasks - conditionally rendered based on collapse state */}
            {!isCollapsed && (
              <div className="space-y-2">
                {(statusTasks as Task[]).map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    onClick={onTaskClick}
                    showProject={showProject}
                    getProjectName={getProjectName}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface TaskListItemProps {
  task: Task;
  onClick?: (task: Task) => void;
  showProject?: boolean;
  getProjectName?: (projectId: string) => string | null;
}

function TaskListItem({ task, onClick, showProject, getProjectName }: TaskListItemProps) {
  const Icon = statusIcons[task.status];
  const projectName = showProject && getProjectName ? getProjectName(task.projectId) : null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
        task.status === "done" && "opacity-60"
      )}
      onClick={() => onClick?.(task)}
    >
      <Icon className={cn("size-5 mt-0.5 shrink-0", taskStatusTextColors[task.status])} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "font-medium",
              task.status === "done" && "line-through"
            )}
          >
            {task.title}
          </p>
          {/* Priority badge */}
          {task.priority && (
            <Flag
              className={cn(
                "h-3.5 w-3.5 shrink-0 mt-0.5",
                priorityTextColors[task.priority as TaskPriority]
              )}
            />
          )}
        </div>

        {/* Meta info row */}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {projectName && (
            <span className="flex items-center gap-1">
              <FolderKanban className="h-3 w-3" />
              {projectName}
            </span>
          )}
          {task.due && (
            <span className={cn(
              new Date(task.due) < new Date() && task.status !== "done" && "text-destructive"
            )}>
              Due: {new Date(task.due).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Content preview */}
        {task.content && (
          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
            {task.content}
          </p>
        )}
      </div>
    </div>
  );
}
