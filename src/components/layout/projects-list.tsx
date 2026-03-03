
/**
 * Projects List
 *
 * Sidebar section showing projects for the current workspace.
 * Scrollable when many projects, with "New Project" button.
 */

import { useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, Plus, FolderKanban } from "lucide-react";
import { useProjects } from "@/stores/projects";
import { useCurrentWorkspace } from "@/stores/workspaces";
import { NewProjectModal } from "@/components/projects/new-project-modal";
import { Badge } from "@/components/ui/badge";

interface ProjectsListProps {
  isCollapsed?: boolean;
}

export function ProjectsList({ isCollapsed = false }: ProjectsListProps) {
  const { pathname } = useLocation();
  const currentWorkspace = useCurrentWorkspace();
  const workspaceId = currentWorkspace?.id || null;

  const { data: projects = [], isLoading } = useProjects(workspaceId);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  // Sort projects alphabetically
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  // Don't render if no workspace selected
  if (!workspaceId) {
    return null;
  }

  // Collapsed state - just show icon
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
      <div className="py-2">
        {/* Section Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/70 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          <span>Projects</span>
          {projects.length > 0 && (
            <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px]">
              {projects.length}
            </Badge>
          )}
        </button>

        {/* Projects List (collapsible) */}
        {isExpanded && (
          <div className="mt-1">
            {isLoading ? (
              // Loading skeleton
              <div className="space-y-1 px-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-7 bg-sidebar-accent/30 rounded-md animate-pulse"
                  />
                ))}
              </div>
            ) : sortedProjects.length === 0 ? (
              // Empty state
              <div className="px-2.5 py-2 text-xs text-sidebar-foreground/40 italic">
                No projects yet
              </div>
            ) : (
              // Scrollable projects list (max 300px height)
              <ScrollArea className="max-h-[300px]">
                <div className="px-1 space-y-0.5">
                  {sortedProjects.map((project) => {
                    const projectTo = `/projects/${project.id}`;
                    const isActive = pathname === `/projects/${project.id}`;

                    // Count active tasks (not done)
                    const activeTasks = project.tasksByStatus
                      ? project.tasksByStatus.todo +
                        project.tasksByStatus.doing +
                        project.tasksByStatus.waiting
                      : 0;

                    return (
                      <Link
                        key={project.id}
                        to={projectTo}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        {/* Project dot indicator */}
                        <span className="size-4 shrink-0 flex items-center justify-center">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              isActive
                                ? "bg-sidebar-accent-foreground"
                                : "bg-sidebar-foreground/40"
                            )}
                          />
                        </span>

                        {/* Project name */}
                        <span className="flex-1 truncate">{project.name}</span>

                        {/* Task count badge (only if > 0) */}
                        {activeTasks > 0 && (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "h-4 px-1.5 text-[10px]",
                              isActive && "bg-sidebar-accent-foreground/20"
                            )}
                          >
                            {activeTasks}
                          </Badge>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* New Project button */}
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 mt-1 rounded-md text-sm text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors"
            >
              <Plus className="size-4 shrink-0" />
              <span>New Project</span>
            </button>
          </div>
        )}
      </div>

      <NewProjectModal
        open={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
      />
    </>
  );
}
