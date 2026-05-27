import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types";
import { taskStatusColors, taskStatusLabels, taskStatusOrder } from "@/lib/design-tokens";

interface StatusVisibilityToggleProps {
  /** Task count per status, for the pill labels. */
  counts: Record<TaskStatus, number>;
  /** Statuses currently hidden from the board/list. */
  hiddenStatuses: Set<TaskStatus>;
  /** Toggle a status's visibility. */
  onToggle: (status: TaskStatus) => void;
}

/**
 * A compact row of soft-pill toggles — one per task status — for showing/hiding
 * Kanban columns / List sections on the Tasks page. Deliberately quieter than
 * the filter dropdowns above: no color fill, the status dot carries identity,
 * and filled-vs-outline is the on/off indicator.
 */
export function StatusVisibilityToggle({
  counts,
  hiddenStatuses,
  onToggle,
}: StatusVisibilityToggleProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {taskStatusOrder.map((status) => {
        const hidden = hiddenStatuses.has(status);
        const label = taskStatusLabels[status];
        return (
          <button
            key={status}
            type="button"
            onClick={() => onToggle(status)}
            title={
              hidden
                ? t("pages.tasks.visibility.show", { label })
                : t("pages.tasks.visibility.hide", { label })
            }
            aria-pressed={!hidden}
            className={cn(
              "flex items-center gap-1.5 h-6 px-2 rounded-full border text-[11px] font-medium transition-colors",
              hidden
                ? "border-border/70 bg-transparent text-muted-foreground/60 hover:bg-muted/40 hover:text-muted-foreground"
                : "border-transparent bg-muted text-foreground hover:bg-muted/80",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full shrink-0",
                hidden ? "border border-current opacity-40" : taskStatusColors[status],
              )}
            />
            <span>{label}</span>
            <span className="tabular-nums opacity-60">{counts[status] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
