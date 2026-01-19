"use client";

import { useState, useEffect } from "react";
import { EditorShell } from "@/components/ui/editor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Loader2, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUpdateMeeting, useDeleteMeeting } from "@/stores";
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

  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title);
      setDate(meeting.date);
      setAttendees(meeting.attendees?.join(", ") || "");
      setContent(meeting.content);
    }
  }, [meeting]);

  const handleSave = async () => {
    if (!meeting) return;

    try {
      const attendeesList = attendees
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      await updateMeeting.mutateAsync({
        meetingId: meeting.id,
        areaId: meeting.areaId,
        projectId: meeting.projectId,
        updates: {
          title: title.trim() || meeting.title,
          date: date || meeting.date,
          attendees: attendeesList.length > 0 ? attendeesList : undefined,
          content,
        },
      });
      toast.success("Meeting saved");
      onClose();
    } catch {
      toast.error("Failed to save meeting");
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!meeting) return;

    try {
      await deleteMeeting.mutateAsync({
        meetingId: meeting.id,
        areaId: meeting.areaId,
        projectId: meeting.projectId,
      });
      toast.success("Meeting deleted");
      onClose();
    } catch {
      toast.error("Failed to delete meeting");
    }
  };

  const handleClose = () => {
    setTitle("");
    setDate("");
    setAttendees("");
    setContent("");
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
        <MarkdownEditor
          value={content}
          onChange={setContent}
          placeholder="Write your meeting notes..."
          minHeight="200px"
        />
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

  const footer = (
    <div className="flex gap-2 justify-end">
      <Button
        onClick={handleSave}
        disabled={updateMeeting.isPending}
        className="min-w-[140px]"
      >
        {updateMeeting.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Save Changes
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleDeleteClick}
        disabled={deleteMeeting.isPending}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        {deleteMeeting.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );

  // Fullscreen-specific content: maximized editor with compact metadata
  const fullscreenContent = (
    <div className="flex flex-col h-full space-y-3">
      {/* Large title input - borderless for focus mode */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Meeting title"
        className="text-xl font-semibold border-none shadow-none px-0 h-auto py-1 focus-visible:ring-0 bg-transparent"
      />

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
        <MarkdownEditor
          value={content}
          onChange={setContent}
          placeholder="Write your meeting notes..."
          minHeight="100%"
          className="h-full [&>div]:h-full [&>div>div]:h-full"
        />
      </div>

      {/* NO file path info in fullscreen */}
    </div>
  );

  // Fullscreen-specific footer with hint
  const fullscreenFooter = (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">
        Press Cmd+Shift+F to exit fullscreen
      </span>
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={updateMeeting.isPending}
          className="min-w-[140px]"
        >
          {updateMeeting.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save Changes
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleDeleteClick}
          disabled={deleteMeeting.isPending}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          {deleteMeeting.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <EditorShell
        open={open}
        onClose={handleClose}
        title="Edit Meeting"
        footer={footer}
        fullscreenChildren={fullscreenContent}
        fullscreenFooter={fullscreenFooter}
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
