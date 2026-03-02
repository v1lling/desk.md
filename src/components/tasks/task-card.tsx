"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import { Calendar, GripVertical, FolderKanban, Star } from "lucide-react";
import type { Task } from "@/types";
import { cn } from "@/lib/utils";
import { priorityColors } from "@/lib/design-tokens";

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  showProject?: boolean;
  projectName?: string | null;
  /** Whether this task is highlighted for focus */
  isHighlighted?: boolean;
  /** Callback to toggle highlight status */
  onToggleHighlight?: () => void;
  /** Workspace color for highlight background */
  workspaceColor?: string;
}

export function TaskCard({
  task,
  onClick,
  showProject,
  projectName,
  isHighlighted,
  onToggleHighlight,
  workspaceColor,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Apply highlight styling with workspace color
    ...(isHighlighted && workspaceColor
      ? {
          backgroundColor: `color-mix(in srgb, ${workspaceColor} 12%, transparent)`,
          // Use CSS variable for ring color
          "--tw-ring-color": workspaceColor,
        } as React.CSSProperties
      : {}),
  };

  const card = (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab group touch-none border-border/50 bg-card overflow-hidden",
        "shadow-sm hover:shadow-md hover:border-border",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-lg cursor-grabbing scale-[1.02] rotate-1",
        isHighlighted && "ring-1 ring-offset-1"
      )}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-0" onClick={onClick}>
        {task.priority && (
          <div className={cn("h-0.5",
            task.priority === "high" ? "bg-rose-400" :
            task.priority === "medium" ? "bg-amber-400" : "bg-emerald-400"
          )} />
        )}
        <div className="flex items-start gap-2 p-3.5 pt-3">
          <div className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <div className="flex-1 min-w-0 cursor-pointer">
            {showProject && projectName && (
              <div className="flex items-center gap-1 mb-1.5">
                <FolderKanban className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground truncate">
                  {projectName}
                </span>
              </div>
            )}
            <h4 className="font-medium text-sm leading-snug mb-2 line-clamp-2 text-foreground/90">
              {task.title}
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
              {task.priority && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[11px] font-medium px-1.5 py-0",
                    priorityColors[task.priority]
                  )}
                >
                  {task.priority}
                </Badge>
              )}
              {task.due && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {task.due}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Wrap with context menu if highlight toggle is available
  if (onToggleHighlight) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onToggleHighlight}>
            <Star
              className={cn("h-4 w-4", isHighlighted && "fill-current")}
            />
            {isHighlighted ? "Remove highlight" : "Highlight for focus"}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return card;
}
