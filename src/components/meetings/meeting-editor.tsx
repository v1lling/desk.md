"use client";

import { useState, useEffect } from "react";
import { EditorShell } from "@/components/ui/editor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Loader2, Trash2, Calendar, Users } from "lucide-react";
import { useUpdateMeeting, useDeleteMeeting } from "@/stores";
import type { Meeting } from "@/types";
import { toast } from "sonner";

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

  const handleDelete = async () => {
    if (!meeting) return;

    if (confirm("Are you sure you want to delete this meeting?")) {
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
    <div className="space-y-5">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="meeting-title">Title</Label>
        <Input
          id="meeting-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title"
        />
      </div>

      {/* Date & Attendees row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="meeting-date">Date</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="meeting-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="meeting-attendees">Attendees</Label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="meeting-attendees"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="John, Sarah..."
              className="pl-10"
            />
          </div>
        </div>
      </div>

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
    <div className="flex gap-2">
      <Button
        onClick={handleSave}
        disabled={updateMeeting.isPending}
        className="flex-1"
      >
        {updateMeeting.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Save Changes
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleDelete}
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

  return (
    <EditorShell open={open} onClose={handleClose} title="Edit Meeting" footer={footer}>
      {formContent}
    </EditorShell>
  );
}
