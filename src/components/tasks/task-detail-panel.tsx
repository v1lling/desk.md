"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { EditorShell } from "@/components/ui/editor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { LoadingState } from "@/components/ui/loading-state";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Trash2 } from "lucide-react";
import {
  useUpdateTask,
  useDeleteTask,
  useMoveTaskToProject,
  useProjects,
  useRemoveTaskFromOrder,
  useUpdatePersonalTask,
  useDeletePersonalTask,
} from "@/stores";
import { useAutoSave } from "@/hooks/use-auto-save";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import { toast } from "sonner";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { PERSONAL_SPACE_ID } from "@/lib/orbit/constants";

interface TaskDetailPanelProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

export function TaskDetailPanel({ task, open, onClose }: TaskDetailPanelProps) {
  // Detect if this is a personal task
  const isPersonal = task?.workspaceId === PERSONAL_SPACE_ID;

  // Workspace task hooks
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const moveTaskToProject = useMoveTaskToProject();
  const removeTaskFromOrder = useRemoveTaskFromOrder();
  const { data: projects = [] } = useProjects(isPersonal ? null : task?.workspaceId || null);

  // Personal task hooks
  const updatePersonalTask = useUpdatePersonalTask();
  const deletePersonalTask = useDeletePersonalTask();

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority | "none">("none");
  const [due, setDue] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Track if editor is ready to render (deferred to avoid blocking open animation)
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Track original projectId to detect moves (moves need special handling)
  const [originalProjectId, setOriginalProjectId] = useState("");

  // Sync state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setStatus(task.status);
      setPriority(task.priority || "none");
      setDue(task.due || "");
      setContent(task.content);
      setProjectId(task.projectId);
      setOriginalProjectId(task.projectId);
      
      // Reset ready state when task changes (or on first open)
      setIsEditorReady(false);
    }
  }, [task]);

  // Defer editor rendering to allow panel animation to start smoothly
  // We use requestAnimationFrame to ensure the browser paints the open state first
  useEffect(() => {
    if (open && task && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [open, task, isEditorReady]);

  // Auto-save data (excluding project changes which need file move)
  const autoSaveData = useMemo(
    () => ({
      title,
      status,
      priority: priority === "none" ? undefined : priority,
      due: due || undefined,
      content,
    }),
    [title, status, priority, due, content]
  );

  // Auto-save handler
  const handleAutoSave = useCallback(
    async (data: typeof autoSaveData) => {
      if (!task) return;

      const updates = {
        title: data.title.trim() || task.title,
        status: data.status,
        priority: data.priority,
        due: data.due,
        content: data.content,
      };

      if (isPersonal) {
        await updatePersonalTask.mutateAsync({
          taskId: task.id,
          updates,
        });
      } else {
        await updateTask.mutateAsync({
          taskId: task.id,
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          updates,
        });
      }
    },
    [task, updateTask, updatePersonalTask, isPersonal]
  );

  // Auto-save hook - only enabled when editor is open
  const { status: saveStatus, save: triggerSave, isDirty } = useAutoSave({
    data: autoSaveData,
    onSave: handleAutoSave,
    enabled: open && !!task,
  });

  // Manual save (for project changes or explicit save)
  const handleSave = async () => {
    if (!task) return;

    try {
      // If project changed, move the file first
      if (projectId !== originalProjectId) {
        await moveTaskToProject.mutateAsync({
          taskId: task.id,
          workspaceId: task.workspaceId,
          fromProjectId: originalProjectId,
          toProjectId: projectId,
        });
        setOriginalProjectId(projectId);
      }

      // Save content changes
      await triggerSave();
      toast.success("Task saved");
      onClose();
    } catch {
      toast.error("Failed to save task");
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (!task) return;

    if (isPersonal) {
      deletePersonalTask.mutate(task.id, {
        onSuccess: () => {
          toast.success("Task deleted");
          onClose();
        },
        onError: () => toast.error("Failed to delete task"),
      });
    } else {
      deleteTask.mutate(
        { taskId: task.id, workspaceId: task.workspaceId, projectId: task.projectId },
        {
          onSuccess: () => {
            // Clean up view state ordering
            removeTaskFromOrder.mutate({
              workspaceId: task.workspaceId,
              projectId: task.projectId,
              taskId: task.id,
            });
            toast.success("Task deleted");
            onClose();
          },
          onError: () => toast.error("Failed to delete task"),
        }
      );
    }
  };

  // Handle close - save pending changes if dirty
  const handleClose = async () => {
    if (isDirty) {
      await triggerSave();
    }
    onClose();
  };

  if (!task) return null;

  // Check if project was changed (requires explicit save) - only for workspace tasks
  const projectChanged = !isPersonal && projectId !== originalProjectId;

  // Common metadata toolbar props
  const metadataProps = {
    status,
    onStatusChange: setStatus,
    priority,
    onPriorityChange: setPriority,
    date: due,
    onDateChange: setDue,
    dateLabel: "Due" as const,
    // Only show project for workspace tasks
    ...(isPersonal ? {} : {
      projectId,
      onProjectChange: setProjectId,
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
    }),
  };

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
      <MetadataToolbar {...metadataProps} />

      {/* Content */}
      <div className="space-y-2">
        <Label>Notes</Label>
        {isEditorReady ? (
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Add notes, details, or checklist items..."
            minHeight="200px"
          />
        ) : (
          <div className="h-[200px] border rounded-lg flex items-center justify-center bg-muted/10">
            <LoadingState label="file" />
          </div>
        )}
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

  // Delete button for header
  const deleteButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDeleteClick}
      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );

  // Footer only shown when project changed (needs "Move & Save" button)
  const footer = projectChanged ? (
    <div className="flex justify-end">
      <Button onClick={handleSave} className="min-w-[140px]">
        Move & Save
      </Button>
    </div>
  ) : null;

  // Editable title for fullscreen header
  const fullscreenTitleInput = (
    <Input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder="Task title"
      className="text-lg font-semibold border-none shadow-none px-0 h-auto py-0 focus-visible:ring-0 bg-transparent flex-1"
    />
  );

  // Fullscreen-specific content: maximized editor with compact metadata toolbar
  const fullscreenContent = (
    <div className="flex flex-col h-full space-y-3">
      {/* Compact metadata toolbar */}
      <MetadataToolbar {...metadataProps} />

      {/* Maximized editor - fills remaining space */}
      <div className="flex-1 min-h-0">
        {isEditorReady ? (
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Add notes, details, or checklist items..."
            minHeight="100%"
            className="h-full [&>div]:h-full [&>div>div]:h-full"
          />
        ) : (
          <div className="h-full border rounded-lg flex items-center justify-center bg-muted/10">
            <LoadingState label="editor" />
          </div>
        )}
      </div>

      {/* NO file path info in fullscreen - focus on writing */}
    </div>
  );

  // Fullscreen footer - keyboard hint, and "Move & Save" if needed
  const fullscreenFooter = (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">
        Cmd+Shift+F to exit
      </span>
      {projectChanged && (
        <Button onClick={handleSave} className="min-w-[140px]">
          Move & Save
        </Button>
      )}
    </div>
  );

  return (
    <>
      <EditorShell
        open={open}
        onClose={handleClose}
        title="Edit Task"
        footer={footer}
        fullscreenChildren={fullscreenContent}
        fullscreenFooter={fullscreenFooter}
        fullscreenTitleInput={fullscreenTitleInput}
        headerActions={deleteButton}
        saveStatus={saveStatus}
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
