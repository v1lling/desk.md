
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTask, useUpdateTask, useDeleteTask, useMoveTaskToProject, useProjects, useRemoveTaskFromOrder } from "@/stores";
import { indexDocumentOnSave } from "@/lib/context-index/indexer";
import { useEditorSession, useEditorTab, useEditorSaveShortcut, useEditorSaveAndClose, useEditorProjectMove, useEditorAIInclusion } from "@/hooks/editor";
import { useInternalLinkHandler } from "@/hooks";
import { EditorHeader } from "./editor-header";
import { EditorPathBar } from "./editor-path-bar";
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);

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
    recover,
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

  // Project move
  const { currentProjectId, handleProjectChange } = useEditorProjectMove({
    entity: task,
    save,
    acceptPathChange,
    move: moveTaskToProject.mutateAsync,
    entityLabel: "task",
    buildMoveArgs: (id, ws, from, to) => ({ taskId: id, workspaceId: ws, fromProjectId: from, toProjectId: to }),
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
    isDirty: contentDirty,
    onRecover: recover,
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
      <EditorPathBar filePath={task?.filePath} />
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

      {/* Sticky metadata row */}
      <div className="shrink-0">
        <div className="max-w-4xl mx-auto px-6">
          <MetadataToolbar {...metadataProps} />
          <div className="h-px bg-border/40 mt-4" />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {/* pt-3 + the editor's own py-1 (4px) = 16px, symmetric with the divider's mt-4 */}
        <div className="max-w-4xl mx-auto px-6 pt-3 pb-6">
          {isEditorReady ? (
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Add notes, details, or checklist items..."
              minHeight="400px"
              borderless
              onInternalLinkClick={handleInternalLinkClick}
            />
          ) : (
            <div className="h-[400px] flex items-center justify-center">
              <LoadingState label="editor" display="inline" />
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
