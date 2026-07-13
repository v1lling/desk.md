/**
 * UnscheduledRail — what is on your plate but not yet in the week.
 *
 * The thing you plan *from*: drag a row into a day to schedule it. Overdue is absolute
 * (against today); the other buckets are relative to the week on screen, so paging to
 * next week re-buckets and answers "what is due in the week I am planning".
 */

import { useMemo } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { DueLabel } from "@/components/ui/due-label";
import { priorityOrder } from "@/lib/design-tokens";
import { isOverdue } from "@/lib/format";
import { useOpenTab } from "@/stores/tabs";
import { usePreferencesStore } from "@/stores/preferences";
import type { ActiveTask } from "@desk/core";

interface UnscheduledRailProps {
  tasks: ActiveTask[];
  /** The days on screen — decides what counts as "due this week". */
  days: string[];
  onTaskMouseDown: (task: ActiveTask, e: React.MouseEvent) => void;
  /** The task currently being dragged out of the rail, if any. */
  draggingTaskId?: string;
}

type BucketKey = "overdue" | "dueThisWeek" | "later" | "noDate";

const BUCKET_ORDER: BucketKey[] = ["overdue", "dueThisWeek", "later", "noDate"];

export function UnscheduledRail({
  tasks,
  days,
  onTaskMouseDown,
  draggingTaskId,
}: UnscheduledRailProps) {
  const { t } = useTranslation();
  const { openTask } = useOpenTab();
  const collapsed = usePreferencesStore((s) => s.plannerRailCollapsed);
  const setCollapsed = usePreferencesStore((s) => s.setPlannerRailCollapsed);

  const buckets = useMemo(() => {
    const lastDay = days[days.length - 1];
    const grouped: Record<BucketKey, ActiveTask[]> = {
      overdue: [],
      dueThisWeek: [],
      later: [],
      noDate: [],
    };

    for (const task of tasks) {
      if (!task.due) grouped.noDate.push(task);
      else if (isOverdue(task.due)) grouped.overdue.push(task);
      else if (task.due <= lastDay) grouped.dueThisWeek.push(task);
      else grouped.later.push(task);
    }

    for (const key of ["overdue", "dueThisWeek", "later"] as const) {
      grouped[key].sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
    }
    // Nothing to sort undated work by but how loudly it was flagged.
    grouped.noDate.sort((a, b) => {
      const rank = (task: ActiveTask) =>
        task.priority ? priorityOrder.indexOf(task.priority) : priorityOrder.length;
      return rank(a) - rank(b) || a.title.localeCompare(b.title);
    });

    return grouped;
  }, [tasks, days]);

  if (collapsed) {
    return (
      <div className="w-8 shrink-0 border-l border-border/60 flex flex-col items-center pt-2.5 gap-2">
        <button
          onClick={() => setCollapsed(false)}
          title={t("pages.planner.rail.expand")}
          className="p-1 rounded hover:bg-muted/60 text-muted-foreground transition-colors"
        >
          <Inbox className="h-3.5 w-3.5" />
        </button>
        {tasks.length > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {tasks.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 border-l border-border/60 flex flex-col min-h-0">
      {/* Header — matches the WeekNavigator row's height so the rules line up */}
      <div className="h-10 shrink-0 border-b border-border/60 px-3 flex items-center gap-1.5">
        <Inbox className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium flex-1 truncate">
          {t("pages.planner.rail.title")}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
        <button
          onClick={() => setCollapsed(true)}
          title={t("pages.planner.rail.collapse")}
          className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {tasks.length === 0 ? (
          <p className="p-4 text-center text-[11px] text-muted-foreground/70">
            {t("pages.planner.rail.empty")}
          </p>
        ) : (
          <ScrollArea className="h-full">
            <div className="py-1.5">
              {BUCKET_ORDER.map((key) => {
                const bucket = buckets[key];
                if (bucket.length === 0) return null;

                return (
                  <div key={key} className="mb-1.5 last:mb-0">
                    <div className="px-3 py-1 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wide font-medium",
                          key === "overdue"
                            ? "text-destructive/80"
                            : "text-muted-foreground/70"
                        )}
                      >
                        {t(`pages.planner.rail.${key}`)}
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-foreground/50">
                        {bucket.length}
                      </span>
                    </div>

                    {bucket.map((task) => (
                      <div
                        key={task.id}
                        onMouseDown={(e) => onTaskMouseDown(task, e)}
                        onClick={() =>
                          openTask({
                            id: task.id,
                            title: task.title,
                            workspaceId: task.workspaceId,
                            projectId: task.projectId,
                          })
                        }
                        className={cn(
                          "group flex items-center gap-1.5 px-3 py-1 text-xs cursor-grab",
                          "hover:bg-muted/40 transition-colors",
                          draggingTaskId === task.id && "opacity-40"
                        )}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: task.workspaceColor || "#64748b" }}
                          title={task.workspaceName}
                        />
                        <span className="truncate flex-1">{task.title}</span>
                        {task.priority && (
                          <PriorityIcon priority={task.priority} className="shrink-0" />
                        )}
                        <DueLabel due={task.due} status={task.status} showUpcoming />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
