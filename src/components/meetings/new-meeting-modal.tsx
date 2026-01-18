"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Clock, MapPin, Users, Loader2 } from "lucide-react";
import { useCreateMeeting, useProjects, useCurrentArea } from "@/stores";
import { toast } from "sonner";

interface NewMeetingModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}

export function NewMeetingModal({
  open,
  onClose,
  defaultProjectId,
}: NewMeetingModalProps) {
  const currentArea = useCurrentArea();
  const createMeeting = useCreateMeeting();
  const { data: projects = [] } = useProjects(currentArea?.id || null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [attendees, setAttendees] = useState("");
  const [duration, setDuration] = useState("");
  const [location, setLocation] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || "");

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(defaultProjectId || projects[0].id);
    }
  }, [projects, projectId, defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !currentArea || !projectId) return;

    try {
      const attendeesList = attendees
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      await createMeeting.mutateAsync({
        areaId: currentArea.id,
        projectId,
        title: title.trim(),
        date: date || undefined,
        attendees: attendeesList.length > 0 ? attendeesList : undefined,
        duration: duration ? parseInt(duration, 10) : undefined,
        location: location.trim() || undefined,
      });

      toast.success("Meeting created");

      // Reset form
      setTitle("");
      setDate(new Date().toISOString().split("T")[0]);
      setAttendees("");
      setDuration("");
      setLocation("");
      onClose();
    } catch (error) {
      console.error("Failed to create meeting:", error);
      toast.error("Failed to create meeting");
    }
  };

  const handleClose = () => {
    setTitle("");
    setDate(new Date().toISOString().split("T")[0]);
    setAttendees("");
    setDuration("");
    setLocation("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Meeting</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="meeting-title">Title</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly Sync, Client Call, Sprint Planning..."
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              <Label htmlFor="meeting-duration">Duration (min)</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="meeting-duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="30"
                  min="1"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="meeting-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Zoom, Teams, Office..."
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-attendees">Attendees</Label>
            <div className="relative">
              <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Textarea
                id="meeting-attendees"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                placeholder="John, Sarah, Mike (comma-separated)"
                className="pl-10 min-h-[60px] resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !projectId || createMeeting.isPending}
            >
              {createMeeting.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Meeting
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
