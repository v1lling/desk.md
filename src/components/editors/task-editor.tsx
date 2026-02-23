"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTask, useUpdateTask, useDeleteTask, useMoveTaskToProject, useProjects, useRemoveTaskFromOrder, useTabStore } from "@/stores";
import { indexDocumentOnSave, removeFromIndex } from "@/hooks/use-rag-indexer";
import { useEditorSession } from "@/hooks/use-editor-session";
import { useEditorTab, useInternalLinkHandler } from "@/hooks";
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
  const handleInternalLinkClick = useInternalLinkHandler();
  const { data: task, isLoading: isLoadingTask } = useTask(workspaceId, taskId);

  // Mutations
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const moveTaskToProject = useMoveTaskToProject();
  const removeTaskFromOrder = useRemoveTaskFromOrder();
  const { data: projects = [] } = useProjects(workspaceId);

  // Metadata state
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

  // Initialize metadata from task
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setStatus(task.status);
      setPriority(task.priority || "none");
      setDue(task.due || "");
      setCurrentProjectId(task.projectId);
      setOriginalProjectId(task.projectId);
      setIsEditorReady(false);
      getAiExclusionState(task.filePath, workspaceId).then(setAiExclusionState);
    }
  }, [task?.id, workspaceId]);

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
    getCurrentContent,
    isLoading: isLoadingContent,
    isDirty: contentDirty,
    saveStatus: contentSaveStatus,
    pathChanged,
    newPath,
    fileDeleted,
    acknowledgePathChange,
    acknowledgeDeleted,
    save,
  } = useEditorSession({
    type: "task",
    entityId: taskId,
    filePath: task?.filePath,
    initialContent: "",
    enabled: !!task,
    onSaveComplete: handleSaveComplete,
  });

  // Defer editor rendering
  useEffect(() => {
    if (task && !isLoadingContent && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [task, isLoadingContent, isEditorReady]);

  // Metadata change handlers - save immediately with current body
  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setTitle(newTitle);
      if (task) {
        try {
          await updateTask.mutateAsync({
            taskId: task.id,
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            updates: { title: newTitle.trim() || task.title, content: getCurrentContent() },
          });
        } catch (error) {
          console.error("[task-editor] Failed to save title:", error);
        }
      }
    },
    [task, updateTask, getCurrentContent]
  );

  const handleStatusChange = useCallback(
    async (newStatus: TaskStatus) => {
      setStatus(newStatus);
      if (task) {
        try {
          await updateTask.mutateAsync({
            taskId: task.id,
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            updates: { status: newStatus, content: getCurrentContent() },
          });
        } catch (error) {
          console.error("[task-editor] Failed to save status:", error);
        }
      }
    },
    [task, updateTask, getCurrentContent]
  );

  const handlePriorityChange = useCallback(
    async (newPriority: TaskPriority | "none") => {
      setPriority(newPriority);
      if (task) {
        try {
          await updateTask.mutateAsync({
            taskId: task.id,
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            updates: {
              priority: newPriority === "none" ? undefined : newPriority,
              content: getCurrentContent(),
            },
          });
        } catch (error) {
          console.error("[task-editor] Failed to save priority:", error);
        }
      }
    },
    [task, updateTask, getCurrentContent]
  );

  const handleDueChange = useCallback(
    async (newDue: string) => {
      setDue(newDue);
      if (task) {
        try {
          await updateTask.mutateAsync({
            taskId: task.id,
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            updates: { due: newDue || undefined, content: getCurrentContent() },
          });
        } catch (error) {
          console.error("[task-editor] Failed to save due date:", error);
        }
      }
    },
    [task, updateTask, getCurrentContent]
  );

  // Manage tab title and dirty state
  const isDirty = contentDirty;
  useEditorTab(`task-${taskId}`, title, isDirty);

  // Keyboard shortcut: Cmd+S to save (also handles menu-save event from Tauri native menu)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Also listen for menu save event from Tauri native menu
    let unlistenMenu: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("menu-save", () => {
        save();
      }).then((unlisten) => {
        unlistenMenu = unlisten;
      });
    }).catch(() => {
      // Not in Tauri environment
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlistenMenu?.();
    };
  }, [save]);

  // Handle save-and-close request from tab bar
  const pendingSaveAndClose = useTabStore((state) => state.pendingSaveAndClose);
  const clearPendingSaveAndClose = useTabStore((state) => state.clearPendingSaveAndClose);
  const closeTab = useTabStore((state) => state.closeTab);

  useEffect(() => {
    if (pendingSaveAndClose === `task-${taskId}`) {
      (async () => {
        await save();
        clearPendingSaveAndClose();
        closeTab(`task-${taskId}`);
      })();
    }
  }, [pendingSaveAndClose, taskId, save, clearPendingSaveAndClose, closeTab]);

  // Project move & save
  const handleProjectMove = useCallback(async () => {
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

      await save();
      toast.success("Task saved");
    } catch {
      toast.error("Failed to save task");
    }
  }, [task, currentProjectId, originalProjectId, moveTaskToProject, save]);

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
      if (aiExclusionState.isInExcludedFolder) return;
      try {
        await setAIInclusion(task.filePath, workspaceId, included);
        setAiExclusionState((prev) => ({ ...prev, isExcluded: !included }));
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

  if (pathChanged && newPath) {
    return (
      <FileMovedBanner
        newPath={newPath}
        onAcknowledge={acknowledgePathChange}
      />
    );
  }

  if (isLoadingTask) {
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
        onSave={save}
        isDirty={isDirty}
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
                onInternalLinkClick={handleInternalLinkClick}
              />
            ) : (
              <div className="h-[400px] border rounded-lg flex items-center justify-center bg-muted/10">
                <LoadingState label="editor" />
              </div>
            )}
          </div>

          {projectChanged && (
            <div className="mt-6 flex justify-end">
              <Button onClick={handleProjectMove} className="min-w-[140px]">
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
