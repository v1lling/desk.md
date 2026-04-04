import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { FolderKanban, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilteredListPage } from "@/components/patterns";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NewProjectModal, EditProjectModal } from "@/components/projects";
import { useProjects, useDeleteProject, useCurrentWorkspace } from "@/stores";
import { statusColors } from "@/lib/design-tokens";
import type { Project, ProjectStatus } from "@/types";
import { toast } from "sonner";

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export default function ProjectsPage() {
  const currentWorkspace = useCurrentWorkspace();
  const workspaceId = currentWorkspace?.id || null;
  const { data: projects = [], isLoading } = useProjects(workspaceId);
  const deleteProject = useDeleteProject();
  const navigate = useNavigate();

  const [showNewProject, setShowNewProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredProjects = useMemo(() => {
    const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name));
    if (filterStatus === "all") return sorted;
    return sorted.filter((p) => p.status === filterStatus);
  }, [projects, filterStatus]);

  const handleProjectClick = useCallback(
    (project: Project) => {
      navigate(`/projects/${project.id}/tasks`);
    },
    [navigate]
  );

  const handleDelete = useCallback(async () => {
    if (!deletingProject || !workspaceId) return;
    try {
      await deleteProject.mutateAsync({
        projectId: deletingProject.id,
        workspaceId,
      });
      toast.success("Project deleted");
      setDeletingProject(null);
    } catch {
      toast.error("Failed to delete project");
    }
  }, [deletingProject, workspaceId, deleteProject]);

  return (
    <FilteredListPage
      actionLabel="New Project"
      onAction={() => setShowNewProject(true)}
      filters={[
        {
          id: "status",
          label: "Status",
          value: filterStatus,
          onChange: setFilterStatus,
          options: statusOptions,
          allLabel: "All statuses",
          width: "w-[160px]",
        },
      ]}
      count={filteredProjects.length}
      countLabel="projects"
      modal={
        <>
          <NewProjectModal
            open={showNewProject}
            onClose={() => setShowNewProject(false)}
          />
          {editingProject && (
            <EditProjectModal
              open={!!editingProject}
              onClose={() => setEditingProject(null)}
              project={editingProject}
            />
          )}
          <ConfirmDialog
            open={!!deletingProject}
            onOpenChange={(open) => !open && setDeletingProject(null)}
            title="Delete Project"
            description={`Are you sure you want to delete "${deletingProject?.name}"? This will permanently remove the project and all its tasks, docs, and meetings.`}
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={handleDelete}
          />
        </>
      }
    >
      {isLoading ? (
        <LoadingState label="projects" display="inline" />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description={
            filterStatus !== "all"
              ? "Try selecting a different status or create a new project"
              : "Create your first project to get started"
          }
          display="inline"
        />
      ) : (
        <div className="space-y-1">
          {filteredProjects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              onClick={handleProjectClick}
              onEdit={setEditingProject}
              onDelete={setDeletingProject}
            />
          ))}
        </div>
      )}
    </FilteredListPage>
  );
}

function ProjectRow({
  project,
  onClick,
  onEdit,
  onDelete,
}: {
  project: Project;
  onClick: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  const activeTasks = project.tasksByStatus
    ? project.tasksByStatus.todo +
      project.tasksByStatus.doing +
      project.tasksByStatus.waiting
    : 0;

  return (
    <div
      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => onClick(project)}
    >
      <FolderKanban className="size-4 shrink-0 text-muted-foreground" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{project.name}</span>
          <Badge
            variant="outline"
            className={cn(
              "capitalize text-[10px] h-5 shrink-0",
              statusColors[project.status as ProjectStatus]
            )}
          >
            {project.status}
          </Badge>
        </div>
        {project.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {project.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-2.5 text-xs text-muted-foreground">
          {activeTasks > 0 && (
            <span className="tabular-nums">
              {activeTasks} {activeTasks === 1 ? "task" : "tasks"}
            </span>
          )}
          {(project.docCount ?? 0) > 0 && (
            <span className="tabular-nums">
              {project.docCount} {project.docCount === 1 ? "doc" : "docs"}
            </span>
          )}
          {(project.meetingCount ?? 0) > 0 && (
            <span className="tabular-nums">
              {project.meetingCount}{" "}
              {project.meetingCount === 1 ? "meeting" : "meetings"}
            </span>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit(project);
              }}
            >
              <Pencil className="size-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project);
              }}
            >
              <Trash2 className="size-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
