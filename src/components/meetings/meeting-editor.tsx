"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Loader2, Trash2, Calendar, Clock, MapPin, Users } from "lucide-react";
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
  const [duration, setDuration] = useState("");
  const [location, setLocation] = useState("");
  const [attendees, setAttendees] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title);
      setDate(meeting.date);
      setDuration(meeting.duration?.toString() || "");
      setLocation(meeting.location || "");
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
          duration: duration ? parseInt(duration, 10) : undefined,
          location: location.trim() || undefined,
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
    setDuration("");
    setLocation("");
    setAttendees("");
    setContent("");
    onClose();
  };

  if (!meeting) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col px-0">
        <SheetHeader className="pb-4 border-b border-border/60 px-6">
          <SheetTitle className="sr-only">Edit Meeting</SheetTitle>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold tracking-tight border-none p-0 h-auto focus-visible:ring-0"
            placeholder="Meeting title"
          />
          <div className="flex flex-wrap gap-2 pt-2">
            {meeting.attendees && meeting.attendees.length > 0 && (
              <Badge variant="secondary" className="text-xs font-normal">
                <Users className="h-3 w-3 mr-1" />
                {meeting.attendees.length} attendees
              </Badge>
            )}
            {meeting.duration && (
              <Badge variant="secondary" className="text-xs font-normal">
                <Clock className="h-3 w-3 mr-1" />
                {meeting.duration}m
              </Badge>
            )}
            {meeting.location && (
              <Badge variant="secondary" className="text-xs font-normal">
                <MapPin className="h-3 w-3 mr-1" />
                {meeting.location}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="px-6 py-4 border-b border-border/60 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="meeting-date" className="text-xs">Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="meeting-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meeting-duration" className="text-xs">Duration (min)</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="meeting-duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="30"
                  className="pl-10 h-9"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="meeting-location" className="text-xs">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="meeting-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Zoom, Teams..."
                  className="pl-10 h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meeting-attendees" className="text-xs">Attendees</Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="meeting-attendees"
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  placeholder="John, Sarah..."
                  className="pl-10 h-9"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col py-4 px-6 overflow-hidden">
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Write your meeting notes in markdown..."
            className="flex-1 overflow-hidden"
            minHeight="300px"
          />
        </div>

        <div className="flex justify-between pt-4 px-6 pb-6 border-t border-border/60">
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

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateMeeting.isPending}>
              {updateMeeting.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
