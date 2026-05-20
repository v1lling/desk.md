
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Loader2 } from "lucide-react";
import { useCreateWorkspace } from "@/stores/workspaces";
import { useNavigationStore } from "@/stores/navigation";
import { slugify } from "@/lib/desk/parser";
import { toast } from "sonner";
import { workspaceColorOptions } from "@/lib/design-tokens";
import { ColorPicker } from "@/components/ui/color-picker";

interface NewWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewWorkspaceModal({ open, onClose }: NewWorkspaceModalProps) {
  const createWorkspace = useCreateWorkspace();
  const setCurrentWorkspaceId = useNavigationStore((state) => state.setCurrentWorkspaceId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(workspaceColorOptions[0].value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const id = slugify(name.trim());

    try {
      const newWorkspace = await createWorkspace.mutateAsync({
        id,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });

      toast.success("Workspace created");

      // Switch to the new workspace
      setCurrentWorkspaceId(newWorkspace.id);

      // Reset form
      setName("");
      setDescription("");
      setColor(workspaceColorOptions[0].value);
      onClose();
    } catch (error) {
      console.error("Failed to create workspace:", error);
      toast.error("Failed to create workspace");
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setColor(workspaceColorOptions[0].value);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Workspace</DialogTitle>
          <DialogDescription className="sr-only">Create a workspace to separate an area of your work — a client, side project, or anything else</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FormField id="workspace-name" label="Workspace Name">
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Acme Corp, Side Projects, Studies"
              autoFocus
            />
            {name && (
              <p className="text-xs text-muted-foreground mt-1">
                Folder: ~/Desk/workspaces/{slugify(name.trim()) || "..."}
              </p>
            )}
          </FormField>

          <FormField id="workspace-description" label="Description" optional>
            <Textarea
              id="workspace-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this workspace..."
              className="min-h-[80px] resize-none"
            />
          </FormField>

          <FormField label="Color">
            <ColorPicker value={color} onChange={setColor} />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createWorkspace.isPending}>
              {createWorkspace.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Workspace
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
