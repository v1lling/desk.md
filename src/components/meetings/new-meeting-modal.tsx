
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { FormGrid } from "@/components/ui/form-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Loader2 } from "lucide-react";
import { useCreateMeeting, useProjects, useCurrentWorkspace, useOpenTab } from "@/stores";
import { toast } from "sonner";
import { useTemplatesStore } from "@/stores/templates";
import { resolveVariables } from "@/lib/templates";

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
  const currentWorkspace = useCurrentWorkspace();
  const createMeeting = useCreateMeeting();
  const { data: projects = [] } = useProjects(currentWorkspace?.id || null);
  const { openMeeting } = useOpenTab();
  const getTemplate = useTemplatesStore((s) => s.getTemplate);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [projectId, setProjectId] = useState(defaultProjectId || "");

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(defaultProjectId || projects[0].id);
    }
  }, [projects, projectId, defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !currentWorkspace || !projectId) return;

    try {
      const templateBody = resolveVariables(
        getTemplate("meeting", currentWorkspace.id),
        {
          title: title.trim(),
          date: date || new Date().toISOString().split("T")[0],
          project: projects.find((p) => p.id === projectId)?.name || "",
          workspace: currentWorkspace.name,
        }
      );

      const meeting = await createMeeting.mutateAsync({
        workspaceId: currentWorkspace.id,
        projectId,
        title: title.trim(),
        date: date || undefined,
        templateBody,
      });

      toast.success("Meeting created");

      // Reset form
      setTitle("");
      setDate(new Date().toISOString().split("T")[0]);
      onClose();

      // Auto-open in editor tab
      openMeeting({
        id: meeting.id,
        title: meeting.title,
        workspaceId: meeting.workspaceId,
        projectId: meeting.projectId,
      });
    } catch (error) {
      console.error("Failed to create meeting:", error);
      toast.error("Failed to create meeting");
    }
  };

  const handleClose = () => {
    setTitle("");
    setDate(new Date().toISOString().split("T")[0]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Meeting</DialogTitle>
          <DialogDescription className="sr-only">Create a new meeting in your workspace</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FormField id="meeting-title" label="Title">
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly Sync, Client Call, Sprint Planning..."
              autoFocus
            />
          </FormField>

          <FormGrid>
            <FormField label="Project">
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
            </FormField>

            <FormField id="meeting-date" label="Date">
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
            </FormField>
          </FormGrid>

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
