"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTask, useUpdateTask, useDeleteTask, useMoveTaskToProject, useProjects, useRemoveTaskFromOrder } from "@/stores";
import { indexDocumentOnSave, removeFromIndex } from "@/hooks/use-rag-indexer";
import { useEditorSession } from "@/hooks/use-editor-session";
import { useEditorTab } from "@/hooks";
import { getAiExclusionState, setAIInclusion } from "@/lib/rag/aiignore";
import type { AiExclusionState } from "@/lib/rag/aiignore";
import { EditorHeader } from "./editor-header";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileMovedBanner, FileDeletedBanner } from "@/components/ui/editor-banners";
import { toast } from "sonner";
import type { TaskStatus, TaskPriority } from "@/types";

interface TaskEditorProps {
  taskId: string;
  workspaceId: string;
  projectId?: string;
  onClose: () => void;
}

export function TaskEditor({ taskId, workspaceId, onClose }: TaskEditorProps) {
  const { data: task, isLoading } = useTask(workspaceId, taskId);

  // Task hooks (Personal workspace uses same hooks as other workspaces)
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const moveTaskToProject = useMoveTaskToProject();
  const removeTaskFromOrder = useRemoveTaskFromOrder();
  const { data: projects = [] } = useProjects(workspaceId);

  // Metadata state (not in the markdown body)
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority | "none">("none");
  const [due, setDue] = useState("");
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [originalProjectId, setOriginalProjectId] = useState("");
  const [aiExclusionState, setAiExclusionState] = useState<AiExclusionState>({
    isExcluded: false,
    isInExcludedFolder: false,
  });

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
      // Load AI exclusion state
      getAiExclusionState(task.filePath, workspaceId).then(setAiExclusionState);
    }
  }, [task?.id, workspaceId]); // Only reset when switching to a different task

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
  const handleSaveComplete = useCallback(
    (path: string, content: string) => {
      if (!task) return;
      indexDocumentOnSave({
        path,
        content,
        workspaceId,
        contentType: "task",
        title: title || task.title,
      });
    },
    [task, workspaceId, title]
  );

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
    onSaveComplete: handleSaveComplete,
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

        await updateTask.mutateAsync({
          taskId: task.id,
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          updates,
        });
        setMetadataDirty(false);
      } catch (error) {
        console.error("[task-editor] Failed to save metadata:", error);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [title, status, priority, due, content, metadataDirty, task, updateTask]);

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
      toast.success("Task deleted");
      onClose();
    } catch {
      toast.error("Failed to delete task");
    }
  }, [task, deleteTask, removeTaskFromOrder, onClose]);

  // Map save status for the header
  const saveStatus = useMemo(() => {
    if (contentSaveStatus === "saving") return "saving" as const;
    if (contentSaveStatus === "error") return "error" as const;
    return "idle" as const;
  }, [contentSaveStatus]);

  // Handle AI inclusion toggle
  const handleAIInclusionChange = useCallback(
    async (included: boolean) => {
      if (!task) return;
      // Don't allow changes if in excluded folder
      if (aiExclusionState.isInExcludedFolder) return;
      try {
        await setAIInclusion(task.filePath, workspaceId, included);
        setAiExclusionState((prev) => ({ ...prev, isExcluded: !included }));
        // If excluding, immediately remove from RAG index
        if (!included) {
          await removeFromIndex(task.filePath);
        }
      } catch (error) {
        console.error("[task-editor] Failed to update AI inclusion:", error);
        toast.error("Failed to update AI setting");
      }
    },
    [task, workspaceId, aiExclusionState.isInExcludedFolder]
  );

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

  const projectChanged = currentProjectId !== originalProjectId;

  const metadataProps = {
    status,
    onStatusChange: handleStatusChange,
    priority,
    onPriorityChange: handlePriorityChange,
    date: due,
    onDateChange: handleDueChange,
    dateLabel: "Due" as const,
    projectId: currentProjectId,
    onProjectChange: setCurrentProjectId,
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorHeader
        title={title}
        onTitleChange={handleTitleChange}
        placeholder="Task title"
        saveStatus={saveStatus}
        onDelete={() => setShowDeleteConfirm(true)}
        aiIncluded={!aiExclusionState.isExcluded}
        onAIInclusionChange={handleAIInclusionChange}
        isInExcludedFolder={aiExclusionState.isInExcludedFolder}
        excludedFolderPath={aiExclusionState.excludedFolderPath}
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
