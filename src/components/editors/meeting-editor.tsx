"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useMeeting, useUpdateMeeting, useDeleteMeeting } from "@/stores";
import { indexDocumentOnSave } from "@/hooks/use-rag-indexer";
import { useEditorSession } from "@/hooks/use-editor-session";
import { useEditorTab } from "@/hooks";
import { getAIInclusion, setAIInclusion } from "@/lib/rag/frontmatter";
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
  const { data: meeting, isLoading } = useMeeting(workspaceId, meetingId);

  const updateMeeting = useUpdateMeeting();
  const deleteMeeting = useDeleteMeeting();

  // Metadata state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [attendees, setAttendees] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [aiIncluded, setAiIncludedState] = useState(true);

  // Initialize metadata from meeting (only when switching meetings)
  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title);
      setDate(meeting.date);
      setAttendees(meeting.attendees?.join(", ") || "");
      setIsEditorReady(false);
      // Load AI inclusion state
      getAIInclusion(meeting.filePath, workspaceId).then(setAiIncludedState);
    }
  }, [meeting?.id, workspaceId]); // Only reset when switching to a different meeting

  // Defer editor rendering
  useEffect(() => {
    if (meeting && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [meeting, isEditorReady]);

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
    initialContent: meeting?.content ?? "",
    enabled: !!meeting,
    onSaveComplete: handleSaveComplete,
  });

  // Track metadata changes separately
  const [metadataDirty, setMetadataDirty] = useState(false);

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

  // Debounced save for metadata changes
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
            content, // Include current content to avoid overwriting
          },
        });
        setMetadataDirty(false);
      } catch (error) {
        console.error("[meeting-editor] Failed to save metadata:", error);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [title, date, attendees, content, metadataDirty, meeting, updateMeeting]);

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
      try {
        await setAIInclusion(meeting.filePath, workspaceId, included);
        setAiIncludedState(included);
      } catch (error) {
        console.error("[meeting-editor] Failed to update AI inclusion:", error);
        toast.error("Failed to update AI setting");
      }
    },
    [meeting, workspaceId]
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
        aiIncluded={aiIncluded}
        onAIInclusionChange={handleAIInclusionChange}
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
