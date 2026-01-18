"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, CheckCircle2, Circle, Clock } from "lucide-react";
import type { Project, ProjectStatus } from "@/types";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
}

const statusConfig: Record<
  ProjectStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  active: {
    label: "Active",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: <Circle className="h-3 w-3 fill-current" />,
  },
  paused: {
    label: "Paused",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    icon: <Clock className="h-3 w-3" />,
  },
  completed: {
    label: "Completed",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  archived: {
    label: "Archived",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    icon: <FolderKanban className="h-3 w-3" />,
  },
};

export function ProjectCard({ project }: ProjectCardProps) {
  const status = statusConfig[project.status];
  const totalTasks = project.taskCount || 0;
  const doneTasks = project.tasksByStatus?.done || 0;
  const progressPercent = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  return (
    <Link href={`/projects/view?id=${project.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base font-semibold line-clamp-1">
              {project.name}
            </CardTitle>
            <Badge variant="secondary" className={cn("text-xs shrink-0", status.color)}>
              <span className="mr-1">{status.icon}</span>
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {project.description}
            </p>
          )}
          <div className="space-y-2">
            {/* Task progress */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Tasks</span>
              <span>
                {doneTasks}/{totalTasks}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Task breakdown */}
            {totalTasks > 0 && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                {project.tasksByStatus?.todo ? (
                  <span>{project.tasksByStatus.todo} todo</span>
                ) : null}
                {project.tasksByStatus?.doing ? (
                  <span>{project.tasksByStatus.doing} in progress</span>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
