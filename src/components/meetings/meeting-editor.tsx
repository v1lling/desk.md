"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { EditorShell } from "@/components/ui/editor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { LoadingState } from "@/components/ui/loading-state";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUpdateMeeting, useDeleteMeeting } from "@/stores";
import { useAutoSave } from "@/hooks/use-auto-save";
import type { Meeting } from "@/types";
import { toast } from "sonner";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";

interface MeetingEditorProps {
  meeting: Meeting | null;
  open: boolean;
  onClose: () => void;
}

export function MeetingEditor({ meeting, open, onClose }: MeetingEditorProps) {
  const updateMeeting = useUpdateMeeting();
  const deleteMeeting = useDeleteMeeting();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [attendees, setAttendees] = useState("");
  const [content, setContent] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Track if editor is ready to render (deferred to avoid blocking open animation)
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Sync state when meeting changes
  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title);
      setDate(meeting.date);
      setAttendees(meeting.attendees?.join(", ") || "");
      setContent(meeting.content);
      setAttendees(meeting.attendees?.join(", ") || "");
      setContent(meeting.content);
      
      // Reset ready state when meeting changes (or on first open)
      setIsEditorReady(false);
    }
  }, [meeting]);

  // Defer editor rendering to allow panel animation to start smoothly
  useEffect(() => {
    if (open && meeting && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [open, meeting, isEditorReady]);

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

  // Auto-save hook - only enabled when editor is open
  const { status: saveStatus, save: triggerSave, isDirty } = useAutoSave({
    data: autoSaveData,
    onSave: handleAutoSave,
    enabled: open && !!meeting,
  });

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

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

  // Handle close - save pending changes if dirty
  const handleClose = async () => {
    if (isDirty) {
      await triggerSave();
    }
    onClose();
  };

  if (!meeting) return null;

  const formContent = (
    <div className="space-y-4">
      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Meeting title"
        className="text-base font-medium"
      />

      {/* Metadata toolbar - same component as fullscreen for consistency */}
      <MetadataToolbar
        date={date}
        onDateChange={setDate}
        dateLabel="Date"
        attendees={attendees}
        onAttendeesChange={setAttendees}
      />

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes</Label>
        {isEditorReady ? (
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Write your meeting notes..."
            minHeight="200px"
          />
        ) : (
          <div className="h-[200px] border rounded-lg flex items-center justify-center bg-muted/10">
            <LoadingState label="file" />
          </div>
        )}
      </div>

      {/* File path (read-only info) */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/40">
        <p className="truncate font-mono" title={meeting.filePath}>
          {meeting.filePath}
        </p>
        <p className="mt-1.5">Created: {meeting.created}</p>
      </div>
    </div>
  );

  // Delete button for header
  const deleteButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDeleteClick}
      disabled={deleteMeeting.isPending}
      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );

  // Meetings don't have project moves, so no footer needed in panel mode
  // Save status is shown in header

  // Editable title for fullscreen header
  const fullscreenTitleInput = (
    <Input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder="Meeting title"
      className="text-lg font-semibold border-none shadow-none px-0 h-auto py-0 focus-visible:ring-0 bg-transparent flex-1"
    />
  );

  // Fullscreen-specific content: maximized editor with compact metadata
  const fullscreenContent = (
    <div className="flex flex-col h-full space-y-3">
      {/* Compact metadata toolbar - date and attendees for meetings */}
      <MetadataToolbar
        date={date}
        onDateChange={setDate}
        dateLabel="Date"
        attendees={attendees}
        onAttendeesChange={setAttendees}
      />

      {/* Maximized editor - fills remaining space */}
      <div className="flex-1 min-h-0">
        {isEditorReady ? (
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Write your meeting notes..."
            minHeight="100%"
            className="h-full [&>div]:h-full [&>div>div]:h-full"
          />
        ) : (
          <div className="h-full border rounded-lg flex items-center justify-center bg-muted/10">
            <LoadingState label="file" />
          </div>
        )}
      </div>

      {/* NO file path info in fullscreen */}
    </div>
  );

  // Fullscreen footer - just keyboard hint
  const fullscreenFooter = (
    <span className="text-xs text-muted-foreground">
      Cmd+Shift+F to exit
    </span>
  );

  return (
    <>
      <EditorShell
        open={open}
        onClose={handleClose}
        title="Edit Meeting"
        fullscreenChildren={fullscreenContent}
        fullscreenFooter={fullscreenFooter}
        fullscreenTitleInput={fullscreenTitleInput}
        headerActions={deleteButton}
        saveStatus={saveStatus}
      >
        {formContent}
      </EditorShell>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Meeting"
        description="Are you sure you want to delete this meeting? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
