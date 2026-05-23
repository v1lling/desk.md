
import { useState, useEffect, useCallback, useMemo } from "react";
import { useMeeting, useUpdateMeeting, useDeleteMeeting, useMoveMeetingToProject, useProjects } from "@/stores";
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

interface MeetingEditorProps {
  meetingId: string;
  workspaceId: string;
  projectId?: string;
  onClose: () => void;
}

export function MeetingEditor({ meetingId, workspaceId, onClose }: MeetingEditorProps) {
  const tabId = `meeting-${meetingId}`;
  const handleInternalLinkClick = useInternalLinkHandler();
  const { data: meeting, isLoading: isLoadingMeeting } = useMeeting(workspaceId, meetingId);

  const updateMeeting = useUpdateMeeting();
  const deleteMeeting = useDeleteMeeting();
  const moveMeetingToProject = useMoveMeetingToProject();
  const { data: projects = [] } = useProjects(workspaceId);

  // Metadata state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Shared hooks
  const { aiExclusionState, handleAIInclusionChange } = useEditorAIInclusion(
    meeting?.filePath,
    workspaceId,
    "meeting"
  );

  // Initialize metadata from meeting
  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title);
      setDate(meeting.date);
      setIsEditorReady(false);
    }
  }, [meeting?.id, workspaceId]);

  const handleSaveComplete = useCallback(
    (path: string, content: string) => {
      if (!meeting) return;
      indexDocumentOnSave({
        path,
        content,
        workspaceId,
        contentType: "meeting",
        title: title || meeting.title,
        projectId: meeting.projectId,
        created: meeting.created,
      });
    },
    [meeting, workspaceId, title]
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
    type: "meeting",
    entityId: meetingId,
    filePath: meeting?.filePath,
    // In Tauri the body is loaded fresh from disk; this is only a fallback.
    // In browser mock mode it is the content the editor shows.
    initialContent: meeting?.content ?? "",
    enabled: !!meeting,
    onSaveComplete: handleSaveComplete,
  });

  // Shared save hooks
  useEditorSaveShortcut(save);
  useEditorSaveAndClose(tabId, save);

  // Project move
  const { currentProjectId, handleProjectChange } = useEditorProjectMove({
    entity: meeting,
    save,
    acceptPathChange,
    move: moveMeetingToProject.mutateAsync,
    entityLabel: "meeting",
    buildMoveArgs: (id, ws, from, to) => ({ meetingId: id, workspaceId: ws, fromProjectId: from, toProjectId: to }),
  });

  // Defer editor rendering
  useEffect(() => {
    if (meeting && !isLoadingContent && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [meeting, isLoadingContent, isEditorReady]);

  // Metadata change handlers
  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setTitle(newTitle);
      if (meeting) {
        try {
          await updateMeeting.mutateAsync({
            meetingId: meeting.id,
            workspaceId: meeting.workspaceId,
            projectId: meeting.projectId,
            updates: { title: newTitle.trim() || meeting.title, content: getCurrentContent() },
          });
        } catch (error) {
          console.error("[meeting-editor] Failed to save title:", error);
        }
      }
    },
    [meeting, updateMeeting, getCurrentContent]
  );

  const handleDateChange = useCallback(
    async (newDate: string) => {
      setDate(newDate);
      if (meeting) {
        try {
          await updateMeeting.mutateAsync({
            meetingId: meeting.id,
            workspaceId: meeting.workspaceId,
            projectId: meeting.projectId,
            updates: { date: newDate || meeting.date, content: getCurrentContent() },
          });
        } catch (error) {
          console.error("[meeting-editor] Failed to save date:", error);
        }
      }
    },
    [meeting, updateMeeting, getCurrentContent]
  );

  // Manage tab title and dirty state
  const isDirty = contentDirty;
  useEditorTab(tabId, title, isDirty);

  const saveStatus = useMemo(() => {
    if (contentSaveStatus === "saving") return "saving" as const;
    if (contentSaveStatus === "error") return "error" as const;
    return "idle" as const;
  }, [contentSaveStatus]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!meeting) return;

    try {
      await deleteMeeting.mutateAsync({
        meetingId: meeting.id,
        workspaceId: meeting.workspaceId,
        projectId: meeting.projectId,
      });
      toast.success("Meeting deleted");
      onClose();
    } catch {
      toast.error("Failed to delete meeting");
    }
  }, [meeting, deleteMeeting, onClose]);

  // Render states (deleted, moved, loading, not found)
  const renderState = EditorRenderStates({
    fileDeleted,
    pathChanged,
    newPath,
    isLoading: isLoadingMeeting,
    entity: meeting,
    entityLabel: "meeting",
    onClose,
    acknowledgePathChange,
    acknowledgeDeleted,
    isDirty: contentDirty,
    onRecover: recover,
  });
  if (renderState) return renderState;

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorPathBar filePath={meeting?.filePath} />
      <EditorHeader
        title={title}
        onTitleChange={handleTitleChange}
        placeholder="Meeting title"
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
          <MetadataToolbar
            date={date}
            onDateChange={handleDateChange}
            dateLabel="Date"
            projectId={currentProjectId}
            onProjectChange={handleProjectChange}
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          />
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
              placeholder="Write your meeting notes..."
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
        title="Delete Meeting"
        description="Are you sure you want to delete this meeting? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
