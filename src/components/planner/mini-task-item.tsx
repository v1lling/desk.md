/**
 * MiniTaskItem — Compact task row for inside workspace blocks
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { taskStatusColors } from "@/lib/design-tokens";
import type { ActiveTask } from "@/lib/desk/dashboard";

interface MiniTaskItemProps {
  task: ActiveTask;
  onClick?: () => void;
  onRemove?: () => void;
}

export function MiniTaskItem({ task, onClick, onRemove }: MiniTaskItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 px-1.5 py-1 rounded text-xs",
        "hover:bg-muted/40 transition-colors cursor-pointer"
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          taskStatusColors[task.status]
        )}
      />
      <span className="truncate flex-1">{task.title}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-muted transition-opacity"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
