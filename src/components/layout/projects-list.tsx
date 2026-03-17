import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, Plus, FolderKanban } from "lucide-react";
import { useProjects } from "@/stores/projects";
import { useCurrentWorkspace } from "@/stores/workspaces";
import { NewProjectModal } from "@/components/projects/new-project-modal";
import { SidebarNavRow } from "./sidebar-nav-row";

type ProjectSection = "tasks" | "docs" | "meetings";

interface ProjectsListProps {
  isCollapsed?: boolean;
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
      <div className="h-full min-h-0 overflow-hidden rounded-md">
        <ScrollArea className="h-full">
          <div className="sticky top-0 z-10 border-b border-sidebar-border/60 bg-sidebar/95 px-2.5 py-1.5 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/45">
                Projects
              </span>
              <div className="ml-auto flex items-center gap-2">
                {projects.length > 0 && (
                  <span className="text-[10px] tabular-nums font-medium text-sidebar-foreground/40">
                    {projects.length}
                  </span>
                )}
                <button
                  onClick={() => setShowNewProjectModal(true)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors"
                  title="New Project"
                >
                  <Plus className="size-3.5" />
                  New
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1 px-1.5 py-1.5 pr-3">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded-md bg-sidebar-accent/30 animate-pulse" />
              ))
            ) : sortedProjects.length === 0 ? (
              <div className="px-2 py-2 text-xs italic text-sidebar-foreground/40">No projects yet</div>
            ) : (
              sortedProjects.map((project) => {
                const projectTo = `/projects/${project.id}/tasks`;
                const isExpanded = expandedProjectId === project.id;

                const activeTasks = project.tasksByStatus
                  ? project.tasksByStatus.todo + project.tasksByStatus.doing + project.tasksByStatus.waiting
                  : 0;

                return (
                  <div key={project.id} className="space-y-0.5">
                    <Link
                      to={projectTo}
                      title={project.name}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                        isExpanded
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          "size-3.5 shrink-0 text-sidebar-foreground/60 transition-transform",
                          isExpanded && "rotate-90"
                        )}
                      />

                      <span className="flex-1 truncate font-medium">{project.name}</span>
                    </Link>

                    {isExpanded && (
                      <div className="ml-5 space-y-0.5">
                        <SidebarNavRow to={`/projects/${project.id}/tasks`} label="Tasks" active={activeSection === "tasks"} role="subitem" count={activeTasks} />
                        <SidebarNavRow to={`/projects/${project.id}/docs`} label="Docs" active={activeSection === "docs"} role="subitem" count={project.docCount} />
                        <SidebarNavRow to={`/projects/${project.id}/meetings`} label="Meetings" active={activeSection === "meetings"} role="subitem" count={project.meetingCount} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <NewProjectModal
        open={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
      />
    </>
  );
}
