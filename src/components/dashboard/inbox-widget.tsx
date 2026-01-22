"use client";

import { useState } from "react";
import { Zap, Plus, MoreHorizontal, User, Briefcase, Trash2, Loader2 } from "lucide-react";
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
  useInboxTasks,
  useCreateInboxTask,
  useMoveFromInbox,
  useMoveFromInboxToWorkspace,
  useDeletePersonalTask,
  useWorkspaces,
  useProjects,
} from "@/stores";
import type { Task, Workspace, Project } from "@/types";
import { cn } from "@/lib/utils";
import { SPECIAL_DIRS } from "@/lib/orbit/constants";

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
  const { data: tasks = [], isLoading } = useInboxTasks();
  const { data: workspaces = [] } = useWorkspaces();
  const createTask = useCreateInboxTask();
  const moveFromInbox = useMoveFromInbox();
  const moveToWorkspace = useMoveFromInboxToWorkspace();
  const deleteTask = useDeletePersonalTask();

  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    await createTask.mutateAsync({ title: newTaskTitle.trim() });
    setNewTaskTitle("");
  };

  const handleMoveToPersonal = async (task: Task) => {
    await moveFromInbox.mutateAsync(task.id);
    onTriageComplete?.(task, { type: "personal" });
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
          ? "border-amber-500/50 bg-amber-500/[0.03]"
          : "border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Zap className={cn("size-4", hasTasks ? "text-amber-500" : "text-violet-500")} />
        <h2 className="font-medium">Capture</h2>
        {hasTasks && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {tasks.length} to triage
          </span>
        )}
      </div>

      {/* Quick Add */}
      <form onSubmit={handleQuickAdd} className="mb-3">
        <div className="relative">
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Quick capture..."
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
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="size-4 animate-spin mr-2" />
          Loading...
        </div>
      ) : !hasTasks ? (
        <div className="py-6 text-center text-muted-foreground text-sm">
          Capture tasks quickly, triage later
        </div>
      ) : (
        <ScrollArea className="max-h-[280px]">
          <div className="space-y-1.5">
            {tasks.map((task) => (
              <CaptureItem
                key={task.id}
                task={task}
                workspaces={workspaces}
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

// Keep old name as alias for backward compatibility
export const InboxWidget = CaptureWidget;

interface CaptureItemProps {
  task: Task;
  workspaces: Workspace[];
  onMoveToPersonal: () => void;
  onMoveToWorkspace: (workspace: Workspace, projectId: string, projectName: string) => void;
  onDelete: () => void;
}

function CaptureItem({
  task,
  workspaces,
  onMoveToPersonal,
  onMoveToWorkspace,
  onDelete,
}: CaptureItemProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border-l-2 border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 transition-colors group">
      <span className="flex-1 text-sm font-medium truncate">{task.title}</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 opacity-60 group-hover:opacity-100 transition-opacity text-xs font-medium"
          >
            Triage
            <MoreHorizontal className="size-3.5 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* Personal Tasks */}
          <DropdownMenuItem onClick={onMoveToPersonal}>
            <User className="size-4 mr-2" />
            Move to Personal Tasks
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
              No workspaces yet
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Delete */}
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4 mr-2" />
            Delete
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
  const { data: projects = [] } = useProjects(workspace.id);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Briefcase className="size-4 mr-2" />
        {workspace.name}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-48">
        {/* Unassigned option */}
        <DropdownMenuItem
          onClick={() => onSelect(SPECIAL_DIRS.UNASSIGNED, "Unassigned")}
        >
          Unassigned
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
