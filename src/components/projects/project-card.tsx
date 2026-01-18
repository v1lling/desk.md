"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, CheckCircle2, Circle, Clock } from "lucide-react";
import type { Project, ProjectStatus } from "@/types";
import { cn } from "@/lib/utils";
import { statusColors } from "@/lib/design-tokens";

interface ProjectCardProps {
  project: Project;
}

const statusConfig: Record<
  ProjectStatus,
  { label: string; icon: React.ReactNode }
> = {
  active: {
    label: "Active",
    icon: <Circle className="h-2.5 w-2.5 fill-current" />,
  },
  paused: {
    label: "Paused",
    icon: <Clock className="h-2.5 w-2.5" />,
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle2 className="h-2.5 w-2.5" />,
  },
  archived: {
    label: "Archived",
    icon: <FolderKanban className="h-2.5 w-2.5" />,
  },
};

export function ProjectCard({ project }: ProjectCardProps) {
  const status = statusConfig[project.status];
  const totalTasks = project.taskCount || 0;
  const doneTasks = project.tasksByStatus?.done || 0;
  const progressPercent = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  return (
    <Link href={`/projects/view?id=${project.id}`}>
      <Card className={cn(
        "cursor-pointer h-full border-border/60",
        "shadow-sm hover:shadow-md hover:border-border",
        "transition-all duration-150"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-[15px] font-semibold line-clamp-1 text-foreground/90">
              {project.name}
            </CardTitle>
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] font-medium shrink-0 gap-1 px-1.5 py-0.5",
                statusColors[project.status]
              )}
            >
              {status.icon}
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {project.description && (
            <p className="text-[13px] text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
              {project.description}
            </p>
          )}
          <div className="space-y-2.5">
            {/* Task progress */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-medium">Tasks</span>
              <span className="text-foreground/70 tabular-nums">
                {doneTasks}/{totalTasks}
              </span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground/80 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Task breakdown */}
            {totalTasks > 0 && (
              <div className="flex gap-3 text-[11px] text-muted-foreground pt-0.5">
                {project.tasksByStatus?.todo ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                    {project.tasksByStatus.todo} todo
                  </span>
                ) : null}
                {project.tasksByStatus?.doing ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {project.tasksByStatus.doing} in progress
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
