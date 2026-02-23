"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useMeeting, useUpdateMeeting, useDeleteMeeting, useTabStore } from "@/stores";
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

interface MeetingEditorProps {
  meetingId: string;
  workspaceId: string;
  projectId?: string;
  onClose: () => void;
}

export function MeetingEditor({ meetingId, workspaceId, onClose }: MeetingEditorProps) {
  const handleInternalLinkClick = useInternalLinkHandler();
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

  // Initialize metadata from meeting
  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title);
      setDate(meeting.date);
      setAttendees(meeting.attendees?.join(", ") || "");
      setIsEditorReady(false);
      getAiExclusionState(meeting.filePath, workspaceId).then(setAiExclusionState);
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
    acknowledgeDeleted,
    save,
  } = useEditorSession({
    type: "meeting",
    entityId: meetingId,
    filePath: meeting?.filePath,
    initialContent: "",
    enabled: !!meeting,
    onSaveComplete: handleSaveComplete,
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

  // Metadata change handlers - save immediately with current body
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

  const handleAttendeesChange = useCallback(
    async (newAttendees: string) => {
      setAttendees(newAttendees);
      if (meeting) {
        try {
          const attendeesList = newAttendees
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean);
          await updateMeeting.mutateAsync({
            meetingId: meeting.id,
            workspaceId: meeting.workspaceId,
            projectId: meeting.projectId,
            updates: {
              attendees: attendeesList.length > 0 ? attendeesList : undefined,
              content: getCurrentContent(),
            },
          });
        } catch (error) {
          console.error("[meeting-editor] Failed to save attendees:", error);
        }
      }
    },
    [meeting, updateMeeting, getCurrentContent]
  );

  // Manage tab title and dirty state
  const isDirty = contentDirty;
  useEditorTab(`meeting-${meetingId}`, title, isDirty);

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
    if (pendingSaveAndClose === `meeting-${meetingId}`) {
      (async () => {
        await save();
        clearPendingSaveAndClose();
        closeTab(`meeting-${meetingId}`);
      })();
    }
  }, [pendingSaveAndClose, meetingId, save, clearPendingSaveAndClose, closeTab]);

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
      if (aiExclusionState.isInExcludedFolder) return;
      try {
        await setAIInclusion(meeting.filePath, workspaceId, included);
        setAiExclusionState((prev) => ({ ...prev, isExcluded: !included }));
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
        title="Delete Meeting"
        description="Are you sure you want to delete this meeting? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
