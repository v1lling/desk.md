
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Loader2 } from "lucide-react";
import { useCreateWorkspace } from "@/stores/workspaces";
import { useSettingsStore } from "@/stores/settings";
import { slugify } from "@/lib/desk/parser";
import { toast } from "sonner";
import { workspaceColorOptions } from "@/lib/design-tokens";

interface NewWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewWorkspaceModal({ open, onClose }: NewWorkspaceModalProps) {
  const createWorkspace = useCreateWorkspace();
  const setCurrentWorkspaceId = useSettingsStore((state) => state.setCurrentWorkspaceId);

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
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FormField id="workspace-name" label="Workspace Name">
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Client Name or Project"
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
            <div className="flex gap-2 flex-wrap">
              {workspaceColorOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColor(opt.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === opt.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: opt.value }}
                  title={opt.label}
                />
              ))}
            </div>
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
