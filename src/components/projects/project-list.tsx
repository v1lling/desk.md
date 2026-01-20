"use client";

import { ProjectCard } from "./project-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useProjects, useCurrentWorkspace } from "@/stores";
import type { ProjectStatus } from "@/types";

interface ProjectListProps {
  statusFilter?: ProjectStatus | "all";
}

export function ProjectList({ statusFilter = "all" }: ProjectListProps) {
  const currentWorkspace = useCurrentWorkspace();
  const { data: projects = [], isLoading } = useProjects(currentWorkspace?.id || null);

  const filteredProjects =
    statusFilter === "all"
      ? projects
      : projects.filter((p) => p.status === statusFilter);

  if (isLoading) {
    return <LoadingState label="projects" />;
  }

  if (filteredProjects.length === 0) {
    return (
      <EmptyState
        title="No projects yet"
        description="Create your first project to get started"
        className="h-64"
      />
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
