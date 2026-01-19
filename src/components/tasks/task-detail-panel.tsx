"use client";

import { useState, useEffect } from "react";
import { EditorShell } from "@/components/ui/editor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Trash2 } from "lucide-react";
import { useUpdateTask, useDeleteTask, useMoveTaskToProject, useProjects, useRemoveTaskFromOrder } from "@/stores";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import { toast } from "sonner";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";

interface TaskDetailPanelProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

export function TaskDetailPanel({ task, open, onClose }: TaskDetailPanelProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const moveTaskToProject = useMoveTaskToProject();
  const removeTaskFromOrder = useRemoveTaskFromOrder();
  const { data: projects = [] } = useProjects(task?.areaId || null);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority | "none">("none");
  const [due, setDue] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setStatus(task.status);
      setPriority(task.priority || "none");
      setDue(task.due || "");
      setContent(task.content);
      setProjectId(task.projectId);
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;

    // If project changed, move the file first
    if (projectId !== task.projectId) {
      moveTaskToProject.mutate(
        {
          taskId: task.id,
          areaId: task.areaId,
          fromProjectId: task.projectId,
          toProjectId: projectId,
        },
        {
          onSuccess: (movedTask) => {
            // Now update other fields if needed
            if (movedTask) {
              updateTask.mutate(
                {
                  taskId: task.id,
                  areaId: task.areaId,
                  projectId: projectId,
                  updates: {
                    title,
                    status,
                    priority: priority === "none" ? undefined : priority,
                    due: due || undefined,
                    content,
                  },
                },
                {
                  onSuccess: () => toast.success("Task updated"),
                  onError: () => toast.error("Failed to update task"),
                }
              );
            }
          },
          onError: () => toast.error("Failed to move task"),
        }
      );
    } else {
      updateTask.mutate(
        {
          taskId: task.id,
          areaId: task.areaId,
          projectId: task.projectId,
          updates: {
            title,
            status,
            priority: priority === "none" ? undefined : priority,
            due: due || undefined,
            content,
          },
        },
        {
          onSuccess: () => toast.success("Task updated"),
          onError: () => toast.error("Failed to update task"),
        }
      );
    }
    onClose();
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (!task) return;

    deleteTask.mutate(
      { taskId: task.id, areaId: task.areaId, projectId: task.projectId },
      {
        onSuccess: () => {
          // Clean up view state ordering
          removeTaskFromOrder.mutate({
            areaId: task.areaId,
            projectId: task.projectId,
            taskId: task.id,
          });
          toast.success("Task deleted");
        },
        onError: () => toast.error("Failed to delete task"),
      }
    );
    onClose();
  };

  if (!task) return null;

  const formContent = (
    <div className="space-y-4">
      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="text-base font-medium"
      />

      {/* Metadata toolbar - same component as fullscreen for consistency */}
      <MetadataToolbar
        status={status}
        onStatusChange={setStatus}
        priority={priority}
        onPriorityChange={setPriority}
        projectId={projectId}
        onProjectChange={setProjectId}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        date={due}
        onDateChange={setDue}
        dateLabel="Due"
      />

      {/* Content */}
      <div className="space-y-2">
        <Label>Notes</Label>
        <MarkdownEditor
          value={content}
          onChange={setContent}
          placeholder="Add notes, details, or checklist items..."
          minHeight="200px"
        />
      </div>

      {/* File path (read-only info) */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/40">
        <p className="truncate font-mono" title={task.filePath}>
          {task.filePath}
        </p>
        <p className="mt-1.5">Created: {task.created}</p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex gap-2 justify-end">
      <Button onClick={handleSave} className="min-w-[140px]">
        Save Changes
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleDeleteClick}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  // Fullscreen-specific content: maximized editor with compact metadata toolbar
  const fullscreenContent = (
    <div className="flex flex-col h-full space-y-3">
      {/* Large title input - borderless for focus mode */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="text-xl font-semibold border-none shadow-none px-0 h-auto py-1 focus-visible:ring-0 bg-transparent"
      />

      {/* Compact metadata toolbar */}
      <MetadataToolbar
        status={status}
        onStatusChange={setStatus}
        priority={priority}
        onPriorityChange={setPriority}
        projectId={projectId}
        onProjectChange={setProjectId}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        date={due}
        onDateChange={setDue}
        dateLabel="Due"
      />

      {/* Maximized editor - fills remaining space */}
      <div className="flex-1 min-h-0">
        <MarkdownEditor
          value={content}
          onChange={setContent}
          placeholder="Add notes, details, or checklist items..."
          minHeight="100%"
          className="h-full [&>div]:h-full [&>div>div]:h-full"
        />
      </div>

      {/* NO file path info in fullscreen - focus on writing */}
    </div>
  );

  // Fullscreen-specific footer with hint
  const fullscreenFooter = (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">
        Press Cmd+Shift+F to exit fullscreen
      </span>
      <div className="flex gap-2">
        <Button onClick={handleSave} className="min-w-[140px]">
          Save Changes
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleDeleteClick}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <EditorShell
        open={open}
        onClose={onClose}
        title="Edit Task"
        footer={footer}
        fullscreenChildren={fullscreenContent}
        fullscreenFooter={fullscreenFooter}
      >
        {formContent}
      </EditorShell>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
