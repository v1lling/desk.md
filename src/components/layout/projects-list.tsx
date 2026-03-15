/**
 * Projects List
 *
 * Sidebar section showing projects for the current workspace.
 * One project is expanded at a time based on active route.
 */

import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  Plus,
  FolderKanban,
  CheckSquare,
  FileText,
  Calendar,
} from "lucide-react";
import { useProjects } from "@/stores/projects";
import { useCurrentWorkspace } from "@/stores/workspaces";
import { NewProjectModal } from "@/components/projects/new-project-modal";

type ProjectSection = "tasks" | "docs" | "meetings";

interface ProjectsListProps {
  isCollapsed?: boolean;
}

function ProjectSubItem({
  to,
  label,
  icon,
  isActive,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  isActive: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
      )}
    >
      <span className="size-3.5 shrink-0">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export function ProjectsList({ isCollapsed = false }: ProjectsListProps) {
  const { pathname } = useLocation();
  const currentWorkspace = useCurrentWorkspace();
  const workspaceId = currentWorkspace?.id || null;

  const { data: projects = [], isLoading } = useProjects(workspaceId);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const projectRouteMatch = pathname.match(/^\/projects\/([^/]+)\/(tasks|docs|meetings)$/);
  const expandedProjectId = projectRouteMatch?.[1] || null;
  const activeSection = (projectRouteMatch?.[2] as ProjectSection | undefined) || null;

  if (!workspaceId) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className="px-1 py-2">
        <button
          className="w-full flex items-center justify-center p-2 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
          title="Projects"
        >
          <FolderKanban className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="h-full min-h-0 flex flex-col">
        <div className="flex items-center gap-2 px-2.5 py-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
            Projects
          </span>
          {projects.length > 0 && (
            <span className="ml-auto text-[10px] tabular-nums font-medium text-sidebar-foreground/40">
              {projects.length}
            </span>
          )}
        </div>

        <button
          onClick={() => setShowNewProjectModal(true)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors"
        >
          <Plus className="size-4 shrink-0" />
          <span>New Project</span>
        </button>

        <div className="mt-1 flex-1 min-h-0">
          {isLoading ? (
            <div className="space-y-1 px-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-7 bg-sidebar-accent/30 rounded-md animate-pulse"
                />
              ))}
            </div>
          ) : sortedProjects.length === 0 ? (
            <div className="px-2.5 py-2 text-xs text-sidebar-foreground/40 italic">
              No projects yet
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-1 px-1 pb-1">
                {sortedProjects.map((project) => {
                  const projectTo = `/projects/${project.id}/tasks`;
                  const isExpanded = expandedProjectId === project.id;

                  const activeTasks = project.tasksByStatus
                    ? project.tasksByStatus.todo +
                      project.tasksByStatus.doing +
                      project.tasksByStatus.waiting
                    : 0;

                  return (
                    <div key={project.id} className="space-y-0.5">
                      <Link
                        to={projectTo}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                          isExpanded
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        <ChevronRight
                          className={cn("size-3.5 shrink-0 transition-transform", isExpanded && "rotate-90")}
                        />

                        <span className="flex-1 truncate">{project.name}</span>

                        {activeTasks > 0 && (
                          <span
                            className={cn(
                              "text-[10px] tabular-nums font-medium",
                              isExpanded
                                ? "text-sidebar-accent-foreground/70"
                                : "text-sidebar-foreground/40"
                            )}
                          >
                            {activeTasks}
                          </span>
                        )}
                      </Link>

                      {isExpanded && (
                        <div className="ml-6 space-y-0.5">
                          <ProjectSubItem
                            to={`/projects/${project.id}/tasks`}
                            label="Tasks"
                            icon={<CheckSquare className="size-3.5" />}
                            isActive={activeSection === "tasks"}
                          />
                          <ProjectSubItem
                            to={`/projects/${project.id}/docs`}
                            label="Docs"
                            icon={<FileText className="size-3.5" />}
                            isActive={activeSection === "docs"}
                          />
                          <ProjectSubItem
                            to={`/projects/${project.id}/meetings`}
                            label="Meetings"
                            icon={<Calendar className="size-3.5" />}
                            isActive={activeSection === "meetings"}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      <NewProjectModal
        open={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
      />
    </>
  );
}
