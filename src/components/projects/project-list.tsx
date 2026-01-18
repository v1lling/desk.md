"use client";

import { ProjectCard } from "./project-card";
import { useProjects } from "@/stores";
import { useSettingsStore } from "@/stores/settings";
import type { ProjectStatus } from "@/types";

interface ProjectListProps {
  statusFilter?: ProjectStatus | "all";
}

export function ProjectList({ statusFilter = "all" }: ProjectListProps) {
  const currentAreaId = useSettingsStore((state) => state.currentAreaId);
  const { data: projects = [], isLoading } = useProjects(currentAreaId);

  const filteredProjects =
    statusFilter === "all"
      ? projects
      : projects.filter((p) => p.status === statusFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">
          Loading projects...
        </div>
      </div>
    );
  }

  if (filteredProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-lg font-medium mb-1">No projects yet</p>
        <p className="text-sm">Create your first project to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredProjects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
