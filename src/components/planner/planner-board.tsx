/**
 * PlannerBoard — Read-only cross-workspace task overview
 * Shows all plannable tasks (todo/doing/waiting) across workspaces
 */

import { useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  Flag,
  FolderKanban,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, stripMarkdown } from "@/lib/format";
import {
  taskStatusTextColors,
  taskStatusLabels,
  priorityTextColors,
} from "@/lib/design-tokens";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useAllWorkspaceTasks } from "@/stores/planner";
import { useOpenTab } from "@/stores/tabs";
import type { TaskStatus, TaskPriority } from "@/types";
import type { ActiveTask } from "@/lib/desk/dashboard";

const statusIcons = {
  backlog: Archive,
  todo: Circle,
  doing: Loader2,
  waiting: Clock,
  done: CheckCircle2,
} as const;

const statusConfig: Record<string, { label: string; color: string }> = {
  todo: { label: "To Do", color: "bg-muted-foreground/50" },
  doing: { label: "In Progress", color: "bg-blue-500" },
  waiting: { label: "Waiting", color: "bg-amber-500" },
};

const BOARD_STATUSES: TaskStatus[] = ["todo", "doing", "waiting"];

interface PlannerBoardProps {
  viewMode: "kanban" | "list";
  filterWorkspace: string;
}

export function PlannerBoard({ viewMode, filterWorkspace }: PlannerBoardProps) {
  const { data: allTasks = [], isLoading } = useAllWorkspaceTasks();
  const { openTask } = useOpenTab();

  const filteredTasks = useMemo(() => {
    if (filterWorkspace === "all") return allTasks;
    return allTasks.filter((t) => t.workspaceId === filterWorkspace);
  }, [allTasks, filterWorkspace]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, ActiveTask[]> = {
      todo: [],
      doing: [],
      waiting: [],
    };
    for (const task of filteredTasks) {
      if (groups[task.status]) {
        groups[task.status].push(task);
      }
    }
    return groups;
  }, [filteredTasks]);

  const handleTaskClick = (task: ActiveTask) => {
    openTask({
      id: task.id,
      title: task.title,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingState label="tasks" />
      </div>
    );
  }

  if (filteredTasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState title="No active tasks" />
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <BoardListView
        tasks={groupedTasks}
        onTaskClick={handleTaskClick}
      />
    );
  }

  return (
    <BoardKanbanView
      tasks={groupedTasks}
      onTaskClick={handleTaskClick}
    />
  );
}

// ── Kanban View ─────────────────────────────────────────────────────

function BoardKanbanView({
  tasks,
  onTaskClick,
}: {
  tasks: Record<string, ActiveTask[]>;
  onTaskClick: (task: ActiveTask) => void;
}) {
  return (
    <ScrollArea className="flex-1 min-h-0" orientation="horizontal">
      <div className="grid grid-flow-col auto-cols-[280px] gap-4 p-6 min-h-full">
        {BOARD_STATUSES.map((status) => {
          const config = statusConfig[status];
          const statusTasks = tasks[status] || [];

          return (
            <div key={status} className="flex flex-col h-full min-w-[280px]">
              <div className="flex items-center gap-2 mb-3 px-1 shrink-0">
                <div className={cn("w-2 h-2 rounded-full", config.color)} />
                <h3 className="font-semibold text-[13px] text-foreground/80">
                  {config.label}
                </h3>
                <span className="text-[11px] text-muted-foreground ml-auto tabular-nums font-medium">
                  {statusTasks.length}
                </span>
              </div>
              <div className="rounded-xl p-2 bg-muted/20 flex-1">
                <div className="space-y-2">
                  {statusTasks.map((task) => (
                    <BoardTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                    />
                  ))}
                </div>
                {statusTasks.length === 0 && (
                  <div className="flex items-center justify-center h-20 text-[13px] text-muted-foreground/60 border border-dashed border-muted-foreground/15 rounded-lg">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ── List View ───────────────────────────────────────────────────────

function BoardListView({
  tasks,
  onTaskClick,
}: {
  tasks: Record<string, ActiveTask[]>;
  onTaskClick: (task: ActiveTask) => void;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );

  const toggleSection = (status: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-6 space-y-6 max-w-3xl">
        {BOARD_STATUSES.map((status) => {
          const statusTasks = tasks[status] || [];
          if (statusTasks.length === 0) return null;
          const config = statusConfig[status];
          const Icon = statusIcons[status];
          const isCollapsed = collapsedSections.has(status);

          return (
            <div key={status}>
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
                <div className={cn("w-2 h-2 rounded-full", config.color)} />
                <h3 className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {config.label}
                </h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {statusTasks.length}
                </span>
              </button>
              {!isCollapsed && (
                <div className="space-y-2">
                  {statusTasks.map((task) => (
                    <BoardListItem
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ── Shared Task Components ──────────────────────────────────────────

function BoardTaskCard({
  task,
  onClick,
}: {
  task: ActiveTask;
  onClick: () => void;
}) {
  const wsColor = task.workspaceColor || "#64748b";

  return (
    <div
      className={cn(
        "rounded-lg border p-3.5 cursor-pointer",
        "shadow-sm hover:shadow-md transition-all duration-150"
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${wsColor} 5%, var(--color-card))`,
        borderColor: `color-mix(in srgb, ${wsColor} 18%, transparent)`,
      }}
      onClick={onClick}
    >
      {task.priority === "high" && <div className="h-0.5 bg-rose-400 -mt-3.5 -mx-3.5 mb-3 rounded-t-lg" />}
      <div className="flex items-center gap-1 mb-1">
        <Circle
          className="h-2 w-2 shrink-0"
          style={{
            color: task.workspaceColor || "#64748b",
            fill: task.workspaceColor || "#64748b",
          }}
        />
        <span className="text-[11px] text-muted-foreground truncate">
          {task.workspaceName}
        </span>
      </div>
      <h4 className="font-medium text-sm leading-snug mb-2 line-clamp-2 text-foreground/90">
        {task.title}
      </h4>
      <div className="flex items-center gap-2 flex-wrap">
        {task.priority && (
          <span
            className={cn(
              "text-[11px] font-medium px-1.5 py-0 rounded-full border",
              task.priority === "high" &&
                "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800",
              task.priority === "medium" &&
                "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
              task.priority === "low" &&
                "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
            )}
          >
            {task.priority}
          </span>
        )}
        {task.due && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {formatDate(task.due)}
          </span>
        )}
      </div>
    </div>
  );
}

function BoardListItem({
  task,
  onClick,
}: {
  task: ActiveTask;
  onClick: () => void;
}) {
  const Icon = statusIcons[task.status];
  const wsColor = task.workspaceColor || "#64748b";

  return (
    <div
      className="flex items-start gap-3 p-2.5 rounded-lg border-l-2 border border-border/50 bg-card hover:bg-accent/50 transition-colors cursor-pointer"
      style={{
        borderLeftColor: `color-mix(in srgb, ${wsColor} 50%, transparent)`,
      }}
      onClick={onClick}
    >
      <Icon
        className={cn(
          "size-5 mt-0.5 shrink-0",
          taskStatusTextColors[task.status]
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{task.title}</p>
          {task.priority && (
            <Flag
              className={cn(
                "h-3.5 w-3.5 shrink-0 mt-0.5",
                priorityTextColors[task.priority as TaskPriority]
              )}
            />
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Circle
              className="h-2 w-2"
              style={{
                color: task.workspaceColor || "#64748b",
                fill: task.workspaceColor || "#64748b",
              }}
            />
            {task.workspaceName}
          </span>
          {task.due && <span>Due: {formatDate(task.due)}</span>}
        </div>
        {task.content && (
          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
            {stripMarkdown(task.content)}
          </p>
        )}
      </div>
    </div>
  );
}
