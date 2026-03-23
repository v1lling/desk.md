/**
 * MiniTaskItem — Compact task row for inside workspace blocks and unscheduled pool
 * Can be made draggable via the `draggableId` prop
 */

import { useDraggable } from "@dnd-kit/core";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { taskStatusColors } from "@/lib/design-tokens";
import type { ActiveTask } from "@/lib/desk/dashboard";

interface MiniTaskItemProps {
  task: ActiveTask;
  onClick?: () => void;
  onRemove?: () => void;
  /** dnd-kit draggable ID (e.g. "pool-task:abc" or "task:abc"). Enables dragging. */
  draggableId?: string;
  /** Use muted monochrome dot instead of status-colored dot */
  monochrome?: boolean;
}

export function MiniTaskItem({
  task,
  onClick,
  onRemove,
  draggableId,
  monochrome,
}: MiniTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: draggableId || `nondrag-${task.id}`,
    disabled: !draggableId,
    data: { type: "task", taskId: task.id },
  });

  return (
    <div
      ref={draggableId ? setNodeRef : undefined}
      className={cn(
        "group flex items-center gap-1.5 px-1.5 py-1 rounded text-xs",
        "hover:bg-muted/40 transition-colors",
        draggableId ? "cursor-grab" : "cursor-pointer",
        isDragging && "opacity-40"
      )}
      onClick={!isDragging ? onClick : undefined}
      {...(draggableId ? { ...attributes, ...listeners } : {})}
    >
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          monochrome ? "bg-muted-foreground/40" : taskStatusColors[task.status]
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
