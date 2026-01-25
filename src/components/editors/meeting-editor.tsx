"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useMeeting, useUpdateMeeting, useDeleteMeeting } from "@/stores";
import { useTabStore } from "@/stores/tabs";
import { useAutoSave } from "@/hooks/use-auto-save";
import { EditorHeader } from "./editor-header";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MeetingEditorProps {
  meetingId: string;
  workspaceId: string;
  projectId?: string;
  onClose: () => void;
}

export function MeetingEditor({ meetingId, workspaceId, projectId, onClose }: MeetingEditorProps) {
  const { data: meeting, isLoading } = useMeeting(workspaceId, meetingId);

  const updateTab = useTabStore((state) => state.updateTab);
  const setTabDirty = useTabStore((state) => state.setTabDirty);

  const updateMeeting = useUpdateMeeting();
  const deleteMeeting = useDeleteMeeting();

  // Form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [attendees, setAttendees] = useState("");
  const [content, setContent] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Sync state when meeting changes
  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title);
      setDate(meeting.date);
      setAttendees(meeting.attendees?.join(", ") || "");
      setContent(meeting.content);
      setIsEditorReady(false);
    }
  }, [meeting]);

  // Defer editor rendering
  useEffect(() => {
    if (meeting && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [meeting, isEditorReady]);

  // Update tab title
  useEffect(() => {
    if (title) {
      updateTab(`meeting-${meetingId}`, { title });
    }
  }, [title, meetingId, updateTab]);

  // Auto-save data
  const autoSaveData = useMemo(
    () => ({ title, date, attendees, content }),
    [title, date, attendees, content]
  );

  // Auto-save handler
  const handleAutoSave = useCallback(
    async (data: typeof autoSaveData) => {
      if (!meeting) return;

      const attendeesList = data.attendees
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      await updateMeeting.mutateAsync({
        meetingId: meeting.id,
        workspaceId: meeting.workspaceId,
        projectId: meeting.projectId,
        updates: {
          title: data.title.trim() || meeting.title,
          date: data.date || meeting.date,
          attendees: attendeesList.length > 0 ? attendeesList : undefined,
          content: data.content,
        },
      });
    },
    [meeting, updateMeeting]
  );

  // Auto-save hook
  const { status: saveStatus, isDirty } = useAutoSave({
    data: autoSaveData,
    onSave: handleAutoSave,
    enabled: !!meeting,
  });

  // Update tab dirty state
  useEffect(() => {
    setTabDirty(`meeting-${meetingId}`, isDirty);
  }, [isDirty, meetingId, setTabDirty]);

  const handleDeleteConfirm = async () => {
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
  };

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
        onTitleChange={setTitle}
        placeholder="Meeting title"
        saveStatus={saveStatus}
        onDelete={() => setShowDeleteConfirm(true)}
      />

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <MetadataToolbar
            date={date}
            onDateChange={setDate}
            dateLabel="Date"
            attendees={attendees}
            onAttendeesChange={setAttendees}
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
