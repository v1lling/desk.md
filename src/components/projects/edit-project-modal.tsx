import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useUpdateProject } from "@/stores";
import type { Project, ProjectStatus } from "@/types";
import { toast } from "sonner";

interface EditProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
}

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export function EditProjectModal({ open, onClose, project }: EditProjectModalProps) {
  const updateProject = useUpdateProject();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);

  // Sync form state when project changes or modal opens
  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description || "");
      setStatus(project.status);
    }
  }, [open, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    try {
      await updateProject.mutateAsync({
        projectId: project.id,
        workspaceId: project.workspaceId,
        updates: {
          name: name.trim(),
          description: description.trim() || undefined,
          status,
        },
      });

      toast.success("Project updated");
      onClose();
    } catch (error) {
      console.error("Failed to update project:", error);
      toast.error("Failed to update project");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription className="sr-only">Edit project details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FormField id="edit-project-name" label="Project Name">
            <Input
              id="edit-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Website Redesign"
              autoFocus
            />
          </FormField>

          <FormField id="edit-project-description" label="Description" optional>
            <Textarea
              id="edit-project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project..."
              className="min-h-[80px] resize-none"
            />
          </FormField>

          <FormField label="Status">
            <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || updateProject.isPending}>
              {updateProject.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
