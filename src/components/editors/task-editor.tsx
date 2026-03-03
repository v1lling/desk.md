
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTask, useUpdateTask, useDeleteTask, useMoveTaskToProject, useProjects, useRemoveTaskFromOrder } from "@/stores";
import { indexDocumentOnSave } from "@/hooks/use-rag-indexer";
import { useEditorSession } from "@/hooks/use-editor-session";
import { useEditorTab, useInternalLinkHandler } from "@/hooks";
import { useEditorSaveShortcut } from "@/hooks/use-editor-save-shortcut";
import { useEditorSaveAndClose } from "@/hooks/use-editor-save-and-close";
import { useEditorAIInclusion } from "@/hooks/use-editor-ai-inclusion";
import { EditorHeader } from "./editor-header";
import { EditorRenderStates } from "./editor-render-states";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { TaskStatus, TaskPriority } from "@/types";

interface TaskEditorProps {
  taskId: string;
  workspaceId: string;
  projectId?: string;
  onClose: () => void;
}

export function TaskEditor({ taskId, workspaceId, onClose }: TaskEditorProps) {
  const tabId = `task-${taskId}`;
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

  // Shared hooks
  const { aiExclusionState, handleAIInclusionChange } = useEditorAIInclusion(
    task?.filePath,
    workspaceId,
    "task"
  );

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
    acceptPathChange,
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

  // Shared save hooks
  useEditorSaveShortcut(save);
  useEditorSaveAndClose(tabId, save);

  // Defer editor rendering
  useEffect(() => {
    if (task && !isLoadingContent && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [task, isLoadingContent, isEditorReady]);

  // Metadata change handler factory
  const createMetadataHandler = useCallback(
    <T,>(
      setter: (value: T) => void,
      toUpdates: (value: T) => Record<string, unknown>
    ) => {
      return async (value: T) => {
        setter(value);
        if (task) {
          try {
            await updateTask.mutateAsync({
              taskId: task.id,
              workspaceId: task.workspaceId,
              projectId: task.projectId,
              updates: { ...toUpdates(value), content: getCurrentContent() },
            });
          } catch (error) {
            console.error("[task-editor] Failed to save metadata:", error);
          }
        }
      };
    },
    [task, updateTask, getCurrentContent]
  );

  const handleTitleChange = useMemo(
    () => createMetadataHandler(setTitle, (v: string) => ({ title: v.trim() || task?.title })),
    [createMetadataHandler, task?.title]
  );

  const handleStatusChange = useMemo(
    () => createMetadataHandler(setStatus, (v: TaskStatus) => ({ status: v })),
    [createMetadataHandler]
  );

  const handlePriorityChange = useMemo(
    () => createMetadataHandler(setPriority, (v: TaskPriority | "none") => ({
      priority: v === "none" ? undefined : v,
    })),
    [createMetadataHandler]
  );

  const handleDueChange = useMemo(
    () => createMetadataHandler(setDue, (v: string) => ({ due: v || undefined })),
    [createMetadataHandler]
  );

  // Manage tab title and dirty state
  const isDirty = contentDirty;
  useEditorTab(tabId, title, isDirty);

  // Project change — auto-move immediately
  const handleProjectChange = useCallback(async (newProjectId: string) => {
    setCurrentProjectId(newProjectId);
    if (!task || newProjectId === originalProjectId) return;

    try {
      const saved = await save();
      if (!saved) {
        setCurrentProjectId(originalProjectId);
        toast.error("Save failed — cannot move task");
        return;
      }

      const result = await moveTaskToProject.mutateAsync({
        taskId: task.id,
        workspaceId: task.workspaceId,
        fromProjectId: originalProjectId,
        toProjectId: newProjectId,
      });

      if (result?.filePath) {
        acceptPathChange(result.filePath);
      }
      setOriginalProjectId(newProjectId);
    } catch {
      setCurrentProjectId(originalProjectId);
      toast.error("Failed to move task");
    }
  }, [task, originalProjectId, moveTaskToProject, acceptPathChange, save]);

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

  const saveStatus = useMemo(() => {
    if (contentSaveStatus === "saving") return "saving" as const;
    if (contentSaveStatus === "error") return "error" as const;
    return "idle" as const;
  }, [contentSaveStatus]);

  // Render states (deleted, moved, loading, not found)
  const renderState = EditorRenderStates({
    fileDeleted,
    pathChanged,
    newPath,
    isLoading: isLoadingTask,
    entity: task,
    entityLabel: "task",
    onClose,
    acknowledgePathChange,
    acknowledgeDeleted,
  });
  if (renderState) return renderState;

  const metadataProps = {
    status,
    onStatusChange: handleStatusChange,
    priority,
    onPriorityChange: handlePriorityChange,
    date: due,
    onDateChange: handleDueChange,
    dateLabel: "Due" as const,
    projectId: currentProjectId,
    onProjectChange: handleProjectChange,
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
