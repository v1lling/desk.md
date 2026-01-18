"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, GripVertical } from "lucide-react";
import type { Task } from "@/types";
import { cn } from "@/lib/utils";
import { priorityColors } from "@/lib/design-tokens";

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
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
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab group touch-none border-border/60 bg-card",
        "shadow-sm hover:shadow-md hover:border-border",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-lg cursor-grabbing scale-[1.02] rotate-1"
      )}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-3.5" onClick={onClick}>
        <div className="flex items-start gap-2">
          <div className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <div className="flex-1 min-w-0 cursor-pointer">
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
}
