/**
 * PlannerBoard — Read-only cross-workspace task overview
 * Shows tasks across workspaces with toggleable backlog/done columns
 */

import { useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatDate, stripMarkdown } from "@/lib/format";
import { taskStatusColors, taskStatusLabels, taskStatusTextColors } from "@/lib/design-tokens";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useAllWorkspaceTasksAllStatuses } from "@/stores/planner";
import { useWorkspaces } from "@/stores/workspaces";
import { useOpenTab } from "@/stores/tabs";
import type { TaskStatus } from "@desk/core/types";
import type { ActiveTask } from "@desk/core";

const statusIcons = {
  backlog: Archive,
  todo: Circle,
  doing: Loader2,
  waiting: Clock,
  done: CheckCircle2,
} as const;

const CORE_STATUSES: TaskStatus[] = ["todo", "doing", "waiting"];

interface PlannerBoardProps {
  viewMode: "kanban" | "list";
  filterWorkspace: string;
}

export function PlannerBoard({ viewMode, filterWorkspace }: PlannerBoardProps) {
  const { t } = useTranslation();
  const { data: allTasks = [], isLoading } = useAllWorkspaceTasksAllStatuses();
  const { data: workspaces = [] } = useWorkspaces();
  const { openTask } = useOpenTab();
  const [showBacklog, setShowBacklog] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const filteredTasks = useMemo(() => {
    if (filterWorkspace === "all") return allTasks;
    return allTasks.filter((task) => task.workspaceId === filterWorkspace);
  }, [allTasks, filterWorkspace]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, ActiveTask[]> = {
      backlog: [],
      todo: [],
      doing: [],
      waiting: [],
      done: [],
    };
    for (const task of filteredTasks) {
      if (groups[task.status]) {
        groups[task.status].push(task);
      }
    }
    return groups;
  }, [filteredTasks]);

  const activeStatuses: TaskStatus[] = useMemo(
    () => [
      ...(showBacklog ? (["backlog"] as TaskStatus[]) : []),
      ...CORE_STATUSES,
      ...(showDone ? (["done"] as TaskStatus[]) : []),
    ],
    [showBacklog, showDone]
  );

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
        <LoadingState label={t("entities.task.pluralLowercase")} />
      </div>
    );
  }

  if (filteredTasks.length === 0) {
    const wsName =
      filterWorkspace !== "all"
        ? workspaces.find((w) => w.id === filterWorkspace)?.name
        : null;

    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyState
          title={
            wsName
              ? t("emptyStates.tasks.inWorkspace.title", { workspace: wsName })
              : t("emptyStates.tasks.noActive.title")
          }
          description={
            wsName
              ? t("emptyStates.tasks.inWorkspace.description")
              : t("emptyStates.tasks.noActive.description")
          }
          display="inline"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toggle buttons for backlog/done */}
      <div className="shrink-0 px-6 pt-3 flex items-center gap-2">
        <button
          onClick={() => setShowBacklog((prev) => !prev)}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-slate-500/10 text-slate-700 dark:text-slate-300 hover:bg-slate-500/20 transition-colors text-[12px] font-medium"
          title={
            showBacklog
              ? t("pages.planner.toggle.hideColumn", { label: taskStatusLabels.backlog })
              : t("pages.planner.toggle.showColumn", { label: taskStatusLabels.backlog })
          }
        >
          {showBacklog ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
          <span>{taskStatusLabels.backlog}</span>
          <span className="tabular-nums opacity-70">
            {groupedTasks.backlog.length}
          </span>
        </button>
        <button
          onClick={() => setShowDone((prev) => !prev)}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors text-[12px] font-medium"
          title={
            showDone
              ? t("pages.planner.toggle.hideColumn", { label: taskStatusLabels.done })
              : t("pages.planner.toggle.showColumn", { label: taskStatusLabels.done })
          }
        >
          {showDone ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
          <span>{taskStatusLabels.done}</span>
          <span className="tabular-nums opacity-70">
            {groupedTasks.done.length}
          </span>
        </button>
      </div>

      {viewMode === "list" ? (
        <BoardListView
          tasks={groupedTasks}
          statuses={activeStatuses}
          onTaskClick={handleTaskClick}
        />
      ) : (
        <BoardKanbanView
          tasks={groupedTasks}
          statuses={activeStatuses}
          onTaskClick={handleTaskClick}
        />
      )}
    </div>
  );
}

// ── Kanban View ─────────────────────────────────────────────────────

function BoardKanbanView({
  tasks,
  statuses,
  onTaskClick,
}: {
  tasks: Record<string, ActiveTask[]>;
  statuses: TaskStatus[];
  onTaskClick: (task: ActiveTask) => void;
}) {
  const { t } = useTranslation();
  return (
    <ScrollArea className="flex-1 min-h-0" orientation="horizontal">
      <div className="grid grid-flow-col auto-cols-[280px] gap-4 p-6 h-full">
        {statuses.map((status) => {
          const statusTasks = tasks[status] || [];

          return (
            <div
              key={status}
              className="flex flex-col h-full min-w-[280px] min-h-0"
            >
              <div className="flex items-center gap-2 mb-3 px-1 shrink-0">
                <div className={cn("w-2 h-2 rounded-full", taskStatusColors[status])} />
                <h3 className="font-semibold text-[13px] text-foreground/80">
                  {taskStatusLabels[status]}
                </h3>
                <span className="text-[11px] text-muted-foreground ml-auto tabular-nums font-medium">
                  {statusTasks.length}
                </span>
              </div>
              <ScrollArea className="flex-1 min-h-0 rounded-xl bg-muted/20">
                <div className="p-2 space-y-2">
                  {statusTasks.map((task) => (
                    <BoardTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                    />
                  ))}
                  {statusTasks.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-[13px] text-muted-foreground/60 border border-dashed border-muted-foreground/15 rounded-lg">
                      {t("pages.tasks.kanban.noTasks")}
                    </div>
                  )}
                </div>
              </ScrollArea>
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
  statuses,
  onTaskClick,
}: {
  tasks: Record<string, ActiveTask[]>;
  statuses: TaskStatus[];
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
        {statuses.map((status) => {
          const statusTasks = tasks[status] || [];
          if (statusTasks.length === 0) return null;
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
                <div className={cn("w-2 h-2 rounded-full", taskStatusColors[status])} />
                <h3 className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {taskStatusLabels[status]}
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
        {task.priority && <PriorityIcon priority={task.priority} />}
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
  const { t } = useTranslation();
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
            <PriorityIcon priority={task.priority} className="mt-0.5" />
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
          {task.due && <span>{t("pages.tasks.list.dueLabel", { date: formatDate(task.due) })}</span>}
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
