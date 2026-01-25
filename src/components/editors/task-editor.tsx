"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTask, useUpdateTask, useDeleteTask, useMoveTaskToProject, useProjects, useRemoveTaskFromOrder, useUpdatePersonalTask, useDeletePersonalTask } from "@/stores";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useEditorTab } from "@/hooks";
import { EditorHeader } from "./editor-header";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PERSONAL_SPACE_ID } from "@/lib/orbit/constants";
import { toast } from "sonner";
import type { TaskStatus, TaskPriority } from "@/types";

interface TaskEditorProps {
  taskId: string;
  workspaceId: string;
  projectId?: string;
  onClose: () => void;
}

export function TaskEditor({ taskId, workspaceId, projectId, onClose }: TaskEditorProps) {
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

  // Form state
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority | "none">("none");
  const [due, setDue] = useState("");
  const [content, setContent] = useState("");
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [originalProjectId, setOriginalProjectId] = useState("");

  // Sync state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setStatus(task.status);
      setPriority(task.priority || "none");
      setDue(task.due || "");
      setContent(task.content);
      setCurrentProjectId(task.projectId);
      setOriginalProjectId(task.projectId);
      setIsEditorReady(false);
    }
  }, [task]);

  // Defer editor rendering
  useEffect(() => {
    if (task && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [task, isEditorReady]);

  // Auto-save data
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

  // Auto-save hook
  const { status: saveStatus, save: triggerSave, isDirty } = useAutoSave({
    data: autoSaveData,
    onSave: handleAutoSave,
    enabled: !!task,
  });

  // Manage tab title and dirty state
  useEditorTab(`task-${taskId}`, title, isDirty);

  // Manual save (for project changes)
  const handleSave = async () => {
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

      await triggerSave();
      toast.success("Task saved");
    } catch {
      toast.error("Failed to save task");
    }
  };

  const handleDeleteConfirm = async () => {
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
  };

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
    onStatusChange: setStatus,
    priority,
    onPriorityChange: setPriority,
    date: due,
    onDateChange: setDue,
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
        onTitleChange={setTitle}
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
