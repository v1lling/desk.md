import { cn } from "@/lib/utils";
import { priorityMeta } from "@/lib/design-tokens";
import type { TaskPriority } from "@/types";

interface PriorityIconProps {
  priority: TaskPriority;
  /** Extra classes for the wrapper (e.g. alignment). */
  className?: string;
}

/**
 * Signal-bar priority indicator. low/medium render in muted grey so they
 * recede; high renders in rose so it stands out at a glance. Carries a native
 * tooltip + aria-label so the icon-only card usage stays accessible.
 */
export function PriorityIcon({ priority, className }: PriorityIconProps) {
  const { label, icon: Icon, color } = priorityMeta[priority];
  return (
    <span
      title={`${label} priority`}
      className={cn("inline-flex shrink-0", color, className)}
    >
      <Icon className="h-3.5 w-3.5" aria-label={`${label} priority`} />
    </span>
  );
}
