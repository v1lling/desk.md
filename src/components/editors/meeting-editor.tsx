"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useMeeting, useUpdateMeeting, useDeleteMeeting } from "@/stores";
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

interface MeetingEditorProps {
  meetingId: string;
  workspaceId: string;
  projectId?: string;
  onClose: () => void;
}

export function MeetingEditor({ meetingId, workspaceId, onClose }: MeetingEditorProps) {
  const { data: meeting, isLoading: isLoadingMeeting } = useMeeting(workspaceId, meetingId);

  const updateMeeting = useUpdateMeeting();
  const deleteMeeting = useDeleteMeeting();

  // Metadata state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [attendees, setAttendees] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [aiExclusionState, setAiExclusionState] = useState<AiExclusionState>({
    isExcluded: false,
    isInExcludedFolder: false,
  });

  // Track metadata changes separately (declared early for use in sync effect)
  const [metadataDirty, setMetadataDirty] = useState(false);
  const metadataDirtyRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    metadataDirtyRef.current = metadataDirty;
  }, [metadataDirty]);

  // Initialize metadata from meeting (only when switching meetings)
  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title);
      setDate(meeting.date);
      setAttendees(meeting.attendees?.join(", ") || "");
      setIsEditorReady(false);
      // Load AI exclusion state
      getAiExclusionState(meeting.filePath, workspaceId).then(setAiExclusionState);
    }
  }, [meeting?.id, workspaceId]); // Only reset when switching to a different meeting

  // Sync metadata from query when refetch completes (but only when not dirty)
  // This ensures editor picks up changes from disk after saves complete
  // Uses ref to access current dirty state without adding it to dependencies
  useEffect(() => {
    if (meeting && !metadataDirtyRef.current) {
      setTitle(meeting.title);
      setDate(meeting.date);
      setAttendees(meeting.attendees?.join(", ") || "");
    }
  }, [meeting?.title, meeting?.date, meeting?.attendees]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Use editor session for content (markdown body)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleSaveComplete = useCallback(
    (path: string, content: string) => {
      if (!meeting) return;
      indexDocumentOnSave({
        path,
        content,
        workspaceId,
        contentType: "meeting",
        title: title || meeting.title,
      });
    },
    [meeting, workspaceId, title]
  );

  const {
    content,
    setContent,
    isLoading: isLoadingContent,
    isDirty: contentDirty,
    saveStatus: contentSaveStatus,
    pathChanged,
    newPath,
    fileDeleted,
    acknowledgePathChange,
    acknowledgeDeleted,
    forceSave: forceContentSave,
  } = useEditorSession({
    type: "meeting",
    entityId: meetingId,
    filePath: meeting?.filePath,
    initialContent: "", // Fallback for mock mode; real content loaded from disk by useEditorSession
    enabled: !!meeting,
    onSaveComplete: handleSaveComplete,
  });

  // Defer editor rendering (wait for content to load)
  useEffect(() => {
    if (meeting && !isLoadingContent && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [meeting, isLoadingContent, isEditorReady]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    setMetadataDirty(true);
  }, []);

  const handleDateChange = useCallback((newDate: string) => {
    setDate(newDate);
    setMetadataDirty(true);
  }, []);

  const handleAttendeesChange = useCallback((newAttendees: string) => {
    setAttendees(newAttendees);
    setMetadataDirty(true);
  }, []);

  // Debounced save for metadata changes (frontmatter only, not content)
  // Content is saved separately by useEditorSession (400ms) - we use 600ms here
  // to ensure content saves complete before metadata saves read from disk
  useEffect(() => {
    if (!metadataDirty || !meeting) return;

    const timeout = setTimeout(async () => {
      try {
        const attendeesList = attendees
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);

        await updateMeeting.mutateAsync({
          meetingId: meeting.id,
          workspaceId: meeting.workspaceId,
          projectId: meeting.projectId,
          updates: {
            title: title.trim() || meeting.title,
            date: date || meeting.date,
            attendees: attendeesList.length > 0 ? attendeesList : undefined,
            // Note: content is NOT included - useEditorSession handles body saves
            // Domain function (updateMeeting) preserves body from disk when content is undefined
          },
        });
        setMetadataDirty(false);
      } catch (error) {
        console.error("[meeting-editor] Failed to save metadata:", error);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [title, date, attendees, metadataDirty, meeting, updateMeeting]);

  // Manage tab title and dirty state
  const isDirty = contentDirty || metadataDirty;
  useEditorTab(`meeting-${meetingId}`, title, isDirty);

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

  // Map save status for the header
  const saveStatus = useMemo(() => {
    if (contentSaveStatus === "saving") return "saving" as const;
    if (contentSaveStatus === "error") return "error" as const;
    return "idle" as const;
  }, [contentSaveStatus]);

  // Handle AI inclusion toggle
  const handleAIInclusionChange = useCallback(
    async (included: boolean) => {
      if (!meeting) return;
      // Don't allow changes if in excluded folder
      if (aiExclusionState.isInExcludedFolder) return;
      try {
        await setAIInclusion(meeting.filePath, workspaceId, included);
        setAiExclusionState((prev) => ({ ...prev, isExcluded: !included }));
        // If excluding, immediately remove from RAG index
        if (!included) {
          await removeFromIndex(meeting.filePath);
        }
      } catch (error) {
        console.error("[meeting-editor] Failed to update AI inclusion:", error);
        toast.error("Failed to update AI setting");
      }
    },
    [meeting, workspaceId, aiExclusionState.isInExcludedFolder]
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

  if (isLoadingMeeting) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <LoadingState label="meeting" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <p>Meeting not found</p>
          <Button variant="ghost" onClick={onClose} className="mt-2">
            Close tab
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorHeader
        title={title}
        onTitleChange={handleTitleChange}
        placeholder="Meeting title"
        saveStatus={saveStatus}
        onDelete={() => setShowDeleteConfirm(true)}
        aiIncluded={!aiExclusionState.isExcluded}
        onAIInclusionChange={handleAIInclusionChange}
        isInExcludedFolder={aiExclusionState.isInExcludedFolder}
        excludedFolderPath={aiExclusionState.excludedFolderPath}
      />

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <MetadataToolbar
            date={date}
            onDateChange={handleDateChange}
            dateLabel="Date"
            attendees={attendees}
            onAttendeesChange={handleAttendeesChange}
          />

          <div className="mt-6">
            {isEditorReady ? (
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Write your meeting notes..."
                minHeight="400px"
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
        title="Delete Meeting"
        description="Are you sure you want to delete this meeting? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
