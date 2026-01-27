"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTask, useUpdateTask, useDeleteTask, useMoveTaskToProject, useProjects, useRemoveTaskFromOrder, useUpdatePersonalTask, useDeletePersonalTask } from "@/stores";
import { useEditorSession } from "@/hooks/use-editor-session";
import { useEditorTab } from "@/hooks";
import { EditorHeader } from "./editor-header";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileMovedBanner, FileDeletedBanner } from "@/components/ui/editor-banners";
import { PERSONAL_SPACE_ID } from "@/lib/orbit/constants";
import { toast } from "sonner";
import type { TaskStatus, TaskPriority } from "@/types";

interface TaskEditorProps {
  taskId: string;
  workspaceId: string;
  projectId?: string;
  onClose: () => void;
}

export function TaskEditor({ taskId, workspaceId, onClose }: TaskEditorProps) {
  const isPersonal = workspaceId === PERSONAL_SPACE_ID;
  const { data: task, isLoading } = useTask(workspaceId, taskId);

  // Workspace task hooks
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const moveTaskToProject = useMoveTaskToProject();
  const removeTaskFromOrder = useRemoveTaskFromOrder();
  const { data: projects = [] } = useProjects(isPersonal ? null : workspaceId);

  // Personal task hooks
  const updatePersonalTask = useUpdatePersonalTask();
  const deletePersonalTask = useDeletePersonalTask();

  // Metadata state (not in the markdown body)
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority | "none">("none");
  const [due, setDue] = useState("");
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [originalProjectId, setOriginalProjectId] = useState("");

  // Initialize metadata from task (only when switching tasks)
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setStatus(task.status);
      setPriority(task.priority || "none");
      setDue(task.due || "");
      setCurrentProjectId(task.projectId);
      setOriginalProjectId(task.projectId);
      setIsEditorReady(false);
    }
  }, [task?.id]); // Only reset when switching to a different task

  // Defer editor rendering
  useEffect(() => {
    if (task && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [task, isEditorReady]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Use editor session for content (markdown body)
  // ═══════════════════════════════════════════════════════════════════════════
  const {
    content,
    setContent,
    isDirty: contentDirty,
    saveStatus: contentSaveStatus,
    pathChanged,
    newPath,
    fileDeleted,
    acknowledgePathChange,
    acknowledgeDeleted,
    forceSave: forceContentSave,
  } = useEditorSession({
    type: "task",
    entityId: taskId,
    filePath: task?.filePath,
    initialContent: task?.content ?? "",
    enabled: !!task,
  });

  // Track metadata changes separately
  const [metadataDirty, setMetadataDirty] = useState(false);

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    setMetadataDirty(true);
  }, []);

  const handleStatusChange = useCallback((newStatus: TaskStatus) => {
    setStatus(newStatus);
    setMetadataDirty(true);
  }, []);

  const handlePriorityChange = useCallback((newPriority: TaskPriority | "none") => {
    setPriority(newPriority);
    setMetadataDirty(true);
  }, []);

  const handleDueChange = useCallback((newDue: string) => {
    setDue(newDue);
    setMetadataDirty(true);
  }, []);

  // Debounced save for metadata changes
  useEffect(() => {
    if (!metadataDirty || !task) return;

    const timeout = setTimeout(async () => {
      try {
        const updates = {
          title: title.trim() || task.title,
          status,
          priority: priority === "none" ? undefined : priority,
          due: due || undefined,
          content, // Include current content to avoid overwriting
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
        setMetadataDirty(false);
      } catch (error) {
        console.error("[task-editor] Failed to save metadata:", error);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [title, status, priority, due, content, metadataDirty, task, updateTask, updatePersonalTask, isPersonal]);

  // Manage tab title and dirty state
  const isDirty = contentDirty || metadataDirty;
  useEditorTab(`task-${taskId}`, title, isDirty);

  // Manual save (for project changes)
  const handleSave = useCallback(async () => {
    if (!task) return;

    try {
      if (currentProjectId !== originalProjectId) {
        await moveTaskToProject.mutateAsync({
          taskId: task.id,
          workspaceId: task.workspaceId,
          fromProjectId: originalProjectId,
          toProjectId: currentProjectId,
        });
        setOriginalProjectId(currentProjectId);
      }

      await forceContentSave();
      toast.success("Task saved");
    } catch {
      toast.error("Failed to save task");
    }
  }, [task, currentProjectId, originalProjectId, moveTaskToProject, forceContentSave]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!task) return;

    try {
      if (isPersonal) {
        await deletePersonalTask.mutateAsync(task.id);
      } else {
        await deleteTask.mutateAsync({
          taskId: task.id,
          workspaceId: task.workspaceId,
          projectId: task.projectId,
        });
        removeTaskFromOrder.mutate({
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
        });
      }
      toast.success("Task deleted");
      onClose();
    } catch {
      toast.error("Failed to delete task");
    }
  }, [task, isPersonal, deletePersonalTask, deleteTask, removeTaskFromOrder, onClose]);

  // Map save status for the header
  const saveStatus = useMemo(() => {
    if (contentSaveStatus === "saving") return "saving" as const;
    if (contentSaveStatus === "error") return "error" as const;
    return "idle" as const;
  }, [contentSaveStatus]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Render states
  // ═══════════════════════════════════════════════════════════════════════════

  // File was deleted externally
  if (fileDeleted) {
    return (
      <FileDeletedBanner
        onClose={() => {
          acknowledgeDeleted();
          onClose();
        }}
      />
    );
  }

  // File was moved/renamed externally
  if (pathChanged && newPath) {
    return (
      <FileMovedBanner
        newPath={newPath}
        onAcknowledge={acknowledgePathChange}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <LoadingState label="task" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <p>Task not found</p>
          <Button variant="ghost" onClick={onClose} className="mt-2">
            Close tab
          </Button>
        </div>
      </div>
    );
  }

  const projectChanged = !isPersonal && currentProjectId !== originalProjectId;

  const metadataProps = {
    status,
    onStatusChange: handleStatusChange,
    priority,
    onPriorityChange: handlePriorityChange,
    date: due,
    onDateChange: handleDueChange,
    dateLabel: "Due" as const,
    ...(isPersonal ? {} : {
      projectId: currentProjectId,
      onProjectChange: setCurrentProjectId,
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
    }),
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorHeader
        title={title}
        onTitleChange={handleTitleChange}
        placeholder="Task title"
        saveStatus={saveStatus}
        onDelete={() => setShowDeleteConfirm(true)}
      />

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <MetadataToolbar {...metadataProps} />

          <div className="mt-6">
            {isEditorReady ? (
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Add notes, details, or checklist items..."
                minHeight="400px"
              />
            ) : (
              <div className="h-[400px] border rounded-lg flex items-center justify-center bg-muted/10">
                <LoadingState label="editor" />
              </div>
            )}
          </div>

          {projectChanged && (
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave} className="min-w-[140px]">
                Move & Save
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
