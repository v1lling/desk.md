/**
 * DueStrip — a dot per task due on this day, under the day header.
 *
 * Counts every task due that day, including ones not planned that day: the strip says
 * what is *due*, the grid says what is *planned*, and the gap between them is the point
 * of looking. Height is fixed whether or not there are dots, so headers never jitter.
 */

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { isOverdue } from "@/lib/format";
import type { ActiveTask } from "@desk/core";

/** Beyond this many, dots stop being countable at a glance and become a number. */
const MAX_DOTS = 5;

interface DueStripProps {
  tasks: ActiveTask[];
}

export function DueStrip({ tasks }: DueStripProps) {
  const { t } = useTranslation();

  return (
    <div
      className="h-2.5 flex items-center justify-center gap-0.5"
      // No Tooltip primitive exists in components/ui, and one dot-row does not justify
      // building one. The native tooltip carries the titles.
      title={tasks.length ? tasks.map((task) => task.title).join("\n") : undefined}
    >
      {tasks.slice(0, MAX_DOTS).map((task) => (
        <span
          key={task.id}
          className={cn(
            "w-1 h-1 rounded-full shrink-0",
            task.due && isOverdue(task.due) && "bg-destructive"
          )}
          style={
            task.due && isOverdue(task.due)
              ? undefined
              : { backgroundColor: task.workspaceColor || "#64748b" }
          }
        />
      ))}
      {tasks.length > MAX_DOTS && (
        <span
          className="text-[9px] leading-none text-muted-foreground/60 tabular-nums"
          aria-label={t("pages.planner.dueStrip.count", { count: tasks.length })}
        >
          +{tasks.length - MAX_DOTS}
        </span>
      )}
    </div>
  );
}
