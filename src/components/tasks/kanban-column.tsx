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
  getProjectName?: (projectId: string) => string;
}

const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: "To Do", color: "bg-muted-foreground/50" },
  doing: { label: "In Progress", color: "bg-blue-500" },
  done: { label: "Done", color: "bg-emerald-500" },
};

export function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  showProject,
  getProjectName,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const config = statusConfig[status];

  return (
    <div className="flex flex-col h-full min-w-[300px] w-[300px]">
      {/* Column header */}
      <div className="flex items-center gap-2.5 mb-4 px-1">
        <div className={cn("w-2 h-2 rounded-full", config.color)} />
        <h3 className="font-semibold text-[13px] text-foreground/80">{config.label}</h3>
        <span className="text-[11px] text-muted-foreground ml-auto tabular-nums font-medium">
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-xl p-2 transition-all duration-200 min-h-[200px]",
          isOver
            ? "bg-accent/70 ring-2 ring-ring/20"
            : "bg-muted/20"
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2.5">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick?.(task)}
                showProject={showProject}
                projectName={getProjectName?.(task.projectId)}
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
