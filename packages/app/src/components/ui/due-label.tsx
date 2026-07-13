/**
 * DueLabel — a task's due date, shown only when it is worth showing.
 *
 * Inside a planner block a task row is ~20px tall and already carries a coloured status
 * dot, so a date three weeks out is pure noise: by default only overdue and due-today
 * render. The rail has room for the full picture and passes `showUpcoming`.
 */

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { dueAccent } from "@/lib/design-tokens";
import { formatDateShort, isDueToday, isOverdue } from "@/lib/format";
import type { TaskStatus } from "@desk/core/types";

interface DueLabelProps {
  due?: string;
  status: TaskStatus;
  /** Also render dates further out, muted. The rail wants these; a block does not. */
  showUpcoming?: boolean;
  className?: string;
}

export function DueLabel({ due, status, showUpcoming, className }: DueLabelProps) {
  const { t } = useTranslation();

  // A finished task has no deadline left to miss.
  if (!due || status === "done") return null;

  const overdue = isOverdue(due);
  const today = isDueToday(due);
  if (!overdue && !today && !showUpcoming) return null;

  const tone = overdue
    ? dueAccent.overdue
    : today
      ? dueAccent.today
      : dueAccent.upcoming;

  return (
    <span
      className={cn("text-[10px] tabular-nums shrink-0", tone, className)}
      title={formatDateShort(due)}
    >
      {today ? t("pages.planner.due.today") : formatDateShort(due)}
    </span>
  );
}
