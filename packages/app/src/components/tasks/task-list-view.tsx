
import { useMemo, useState } from "react";
import { Archive, CheckCircle2, Circle, Clock, Loader2, FolderKanban, ChevronRight, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatDate, isOverdue, stripMarkdown } from "@/lib/format";
import {
  taskStatusTextColors,
  taskStatusLabels,
  taskStatusOrder,
} from "@/lib/design-tokens";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { AIBadge } from "@/components/ui/ai-badge";
import type { Task, TaskStatus } from "@desk/core/types";
import { getScopedEntityKey } from "@desk/core";

interface TaskListViewProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  /** Show project name on tasks */
  showProject?: boolean;
  /** Get project name by ID */
  getProjectName?: (projectId: string) => string | null;
  /** Group tasks by status (default: true) */
  groupByStatus?: boolean;
  /** Statuses hidden from the list (only applies when grouped by status) */
  hiddenStatuses: Set<TaskStatus>;
  isLoading?: boolean;
  /** Highlighted task keys for the current workspace/project scope. */
  highlightedTasks?: Set<string>;
  onToggleHighlight?: (taskKey: string) => void;
}

/** Icon mapping for task statuses */
const statusIcons = {
  backlog: Archive,
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
  hiddenStatuses,
  isLoading,
  highlightedTasks,
  onToggleHighlight,
}: TaskListViewProps) {
  const { t } = useTranslation();
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
      backlog: tasks.filter((t) => t.status === "backlog"),
      todo: tasks.filter((t) => t.status === "todo"),
      doing: tasks.filter((t) => t.status === "doing"),
      waiting: tasks.filter((t) => t.status === "waiting"),
      done: tasks.filter((t) => t.status === "done"),
    };
  }, [tasks, groupByStatus]);

  if (isLoading) {
    return <LoadingSkeleton variant="list" rows={7} announce />;
  }

  if (tasks.length === 0) {
    return <EmptyState title={t("emptyStates.tasks.noResults.title")} />;
  }

  if (!groupByStatus) {
    return (
      <div className="space-y-2 max-w-3xl">
        {tasks.map((task) => (
          <TaskListItem
            key={getScopedEntityKey(task)}
            task={task}
            onClick={onTaskClick}
            showProject={showProject}
            getProjectName={getProjectName}
            highlightedTasks={highlightedTasks}
            onToggleHighlight={onToggleHighlight}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {taskStatusOrder.map((status) => {
        if (hiddenStatuses.has(status)) return null;

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
                    key={getScopedEntityKey(task)}
                    task={task}
                    onClick={onTaskClick}
                    showProject={showProject}
                    getProjectName={getProjectName}
                    highlightedTasks={highlightedTasks}
                    onToggleHighlight={onToggleHighlight}
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
  highlightedTasks?: Set<string>;
  onToggleHighlight?: (taskKey: string) => void;
}

function TaskListItem({
  task,
  onClick,
  showProject,
  getProjectName,
  highlightedTasks,
  onToggleHighlight,
}: TaskListItemProps) {
  const { t } = useTranslation();
  const Icon = statusIcons[task.status];
  const projectName = showProject && getProjectName ? getProjectName(task.projectId) : null;
  const taskKey = getScopedEntityKey(task);
  const isHighlighted = highlightedTasks?.has(taskKey) || highlightedTasks?.has(task.id);

  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
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
            {task.author === "ai" && <AIBadge className="ml-1.5 align-middle" />}
          </p>
          {/* Priority indicator */}
          {task.priority && (
            <PriorityIcon priority={task.priority} className="mt-0.5" />
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
              isOverdue(task.due) && task.status !== "done" && "text-destructive"
            )}>
              {t("pages.tasks.list.dueLabel", { date: formatDate(task.due) })}
            </span>
          )}
        </div>

        {/* Content preview */}
        {task.content && (
          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
            {stripMarkdown(task.content)}
          </p>
        )}
      </div>
      {onToggleHighlight && (
        <button
          type="button"
          className={cn(
            "mt-0.5 rounded p-1 text-muted-foreground transition-all hover:bg-muted hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            isHighlighted
              ? "text-brand-accent opacity-100"
              : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onToggleHighlight(taskKey);
          }}
          aria-label={
            isHighlighted
              ? t("menus.taskContextMenu.removeHighlight")
              : t("menus.taskContextMenu.highlightForFocus")
          }
          title={
            isHighlighted
              ? t("menus.taskContextMenu.removeHighlight")
              : t("menus.taskContextMenu.highlightForFocus")
          }
        >
          <Star className={cn("size-3.5", isHighlighted && "fill-current")} />
        </button>
      )}
    </div>
  );
}
