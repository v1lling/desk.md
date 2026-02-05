"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TaskCard } from "./task-card";
import type { Task, TaskStatus } from "@/types";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  showProject?: boolean;
  getProjectName?: (projectId: string) => string | null;
  /** Hide the column header (used when parent provides custom header) */
  hideHeader?: boolean;
  /** Whether this column is currently a drop target (for visual feedback) */
  isDropTarget?: boolean;
  /** Set of highlighted task IDs */
  highlightedTasks?: Set<string>;
  /** Callback to toggle highlight for a task */
  onToggleHighlight?: (taskId: string) => void;
  /** Workspace color for highlight background */
  workspaceColor?: string;
}

const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: "To Do", color: "bg-muted-foreground/50" },
  doing: { label: "In Progress", color: "bg-blue-500" },
  waiting: { label: "Waiting", color: "bg-amber-500" },
  done: { label: "Done", color: "bg-emerald-500" },
};

export function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  showProject,
  getProjectName,
  hideHeader,
  isDropTarget,
  highlightedTasks,
  onToggleHighlight,
  workspaceColor,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const config = statusConfig[status];
  const showHighlight = isOver || isDropTarget;

  return (
    <div className={cn("flex flex-col h-full", !hideHeader && "min-w-[280px] w-[280px]")}>
      {/* Column header */}
      {!hideHeader && (
        <div className="flex items-center gap-2 mb-3 px-1 flex-shrink-0">
          <div className={cn("w-2 h-2 rounded-full", config.color)} />
          <h3 className="font-semibold text-[13px] text-foreground/80">{config.label}</h3>
          <span className="text-[11px] text-muted-foreground ml-auto tabular-nums font-medium">
            {tasks.length}
          </span>
        </div>
      )}

      {/* Drop zone - flex-1 stretches to match siblings */}
      <div
        ref={setNodeRef}
        className={cn(
          "rounded-xl p-2 transition-all duration-200 flex-1",
          showHighlight
            ? "bg-accent/70 ring-2 ring-ring/20"
            : "bg-muted/20"
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick?.(task)}
                showProject={showProject}
                projectName={getProjectName?.(task.projectId)}
                isHighlighted={highlightedTasks?.has(task.id)}
                onToggleHighlight={
                  onToggleHighlight
                    ? () => onToggleHighlight(task.id)
                    : undefined
                }
                workspaceColor={workspaceColor}
              />
            ))}
          </div>
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-24 text-[13px] text-muted-foreground/60">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
