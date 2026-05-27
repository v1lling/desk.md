
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Zap, Plus, MoreHorizontal, User, FolderKanban, Trash2, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCaptureTasks,
  useCreateCaptureTask,
  useMoveCaptureToPersonal,
  useMoveCaptureToWorkspace,
  useDeleteCaptureTask,
  useWorkspaces,
  useProjects,
} from "@/stores";
import type { Task, Workspace, Project } from "@/types";
import { cn } from "@/lib/utils";
import { SPECIAL_DIRS } from "@/lib/desk/constants";

interface CaptureWidgetProps {
  onTriageComplete?: (task: Task, destination: TriageDestination) => void;
}

export interface TriageDestination {
  type: "personal" | "workspace";
  workspaceId?: string;
  projectId?: string;
  workspaceName?: string;
  projectName?: string;
}

export function CaptureWidget({ onTriageComplete }: CaptureWidgetProps) {
  const { t } = useTranslation();
  const { data: tasks = [], isLoading } = useCaptureTasks();
  const { data: workspaces = [] } = useWorkspaces();
  const createTask = useCreateCaptureTask();
  const moveToPersonal = useMoveCaptureToPersonal();
  const moveToWorkspace = useMoveCaptureToWorkspace();
  const deleteTask = useDeleteCaptureTask();

  const [newTaskTitle, setNewTaskTitle] = useState("");

  const homeWorkspace = workspaces.find((w) => w.isHome);
  const homeName = homeWorkspace?.name ?? t("pages.dashboard.capture.defaultHomeName");
  const otherWorkspaces = workspaces.filter((w) => !w.isHome);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    await createTask.mutateAsync({ title: newTaskTitle.trim() });
    setNewTaskTitle("");
  };

  const handleMoveToPersonal = async (task: Task) => {
    await moveToPersonal.mutateAsync(task.id);
    onTriageComplete?.(task, {
      type: "personal",
      workspaceId: homeWorkspace?.id,
      workspaceName: homeName,
    });
  };

  const handleMoveToWorkspace = async (
    task: Task,
    workspace: Workspace,
    projectId: string,
    projectName: string
  ) => {
    await moveToWorkspace.mutateAsync({
      taskId: task.id,
      workspaceId: workspace.id,
      projectId,
    });
    onTriageComplete?.(task, {
      type: "workspace",
      workspaceId: workspace.id,
      projectId,
      workspaceName: workspace.name,
      projectName,
    });
  };

  const handleDelete = async (taskId: string) => {
    await deleteTask.mutateAsync(taskId);
  };

  const hasTasks = tasks.length > 0;

  return (
    <div
      className={cn(
        "bg-card border rounded-lg p-4 transition-colors",
        hasTasks
          ? "border-brand-accent/50 bg-brand-accent/[0.03]"
          : "border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Zap className={cn("size-4", hasTasks ? "text-brand-accent" : "text-primary")} />
        <h2 className="font-medium">{t("pages.dashboard.capture.title")}</h2>
        {hasTasks && (
          <span className="text-xs font-medium text-brand-accent">
            {t("pages.dashboard.capture.toTriageCount", { count: tasks.length })}
          </span>
        )}
      </div>

      {/* Quick Add */}
      <form onSubmit={handleQuickAdd} className="mb-3">
        <div className="relative">
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder={t("pages.dashboard.capture.quickAddPlaceholder")}
            className="pr-9 h-9 text-sm"
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            disabled={!newTaskTitle.trim() || createTask.isPending}
            className="absolute right-0 top-0 h-9 w-9"
          >
            {createTask.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
          </Button>
        </div>
      </form>

      {/* Task List */}
      {isLoading ? (
        <LoadingState label={t("pages.dashboard.capture.loadingLabel")} display="inline" className="py-6" />
      ) : !hasTasks ? (
        <EmptyState title={t("pages.dashboard.capture.emptyTitle")} display="inline" className="py-6" />
      ) : (
        <ScrollArea className="max-h-[280px]">
          <div className="space-y-1.5">
            {tasks.map((task) => (
              <CaptureItem
                key={task.id}
                task={task}
                workspaces={otherWorkspaces}
                homeName={homeName}
                onMoveToPersonal={() => handleMoveToPersonal(task)}
                onMoveToWorkspace={(ws, pid, pname) =>
                  handleMoveToWorkspace(task, ws, pid, pname)
                }
                onDelete={() => handleDelete(task.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

interface CaptureItemProps {
  task: Task;
  workspaces: Workspace[];
  homeName: string;
  onMoveToPersonal: () => void;
  onMoveToWorkspace: (workspace: Workspace, projectId: string, projectName: string) => void;
  onDelete: () => void;
}

function CaptureItem({
  task,
  workspaces,
  homeName,
  onMoveToPersonal,
  onMoveToWorkspace,
  onDelete,
}: CaptureItemProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border-l-2 border-brand-accent bg-brand-accent/5 hover:bg-brand-accent/10 transition-colors group">
      <span className="flex-1 text-sm font-medium truncate">{task.title}</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 opacity-60 group-hover:opacity-100 transition-opacity text-xs font-medium"
          >
            {t("pages.dashboard.capture.triageButton")}
            <MoreHorizontal className="size-3.5 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* Home workspace tasks */}
          <DropdownMenuItem onClick={onMoveToPersonal}>
            <User className="size-4 mr-2" />
            {t("pages.dashboard.capture.moveToHomeTasks", { home: homeName })}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Workspaces */}
          {workspaces.length > 0 ? (
            workspaces.map((workspace) => (
              <WorkspaceSubmenu
                key={workspace.id}
                workspace={workspace}
                onSelect={(projectId, projectName) =>
                  onMoveToWorkspace(workspace, projectId, projectName)
                }
              />
            ))
          ) : (
            <DropdownMenuItem disabled className="text-muted-foreground">
              {t("pages.dashboard.capture.noWorkspacesYet")}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Delete */}
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4 mr-2" />
            {t("common.buttons.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface WorkspaceSubmenuProps {
  workspace: Workspace;
  onSelect: (projectId: string, projectName: string) => void;
}

function WorkspaceSubmenu({ workspace, onSelect }: WorkspaceSubmenuProps) {
  const { t } = useTranslation();
  const { data: projects = [] } = useProjects(workspace.id);
  const unassignedLabel = t("pages.dashboard.capture.unassigned");

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <FolderKanban className="size-4 mr-2" />
        {workspace.name}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-48">
        {/* Unassigned option */}
        <DropdownMenuItem
          onClick={() => onSelect(SPECIAL_DIRS.UNASSIGNED, unassignedLabel)}
        >
          {unassignedLabel}
        </DropdownMenuItem>

        {projects.length > 0 && <DropdownMenuSeparator />}

        {/* Projects */}
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => onSelect(project.id, project.name)}
          >
            {project.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
