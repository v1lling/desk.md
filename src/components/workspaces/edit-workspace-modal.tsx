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
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Loader2 } from "lucide-react";
import { useUpdateWorkspace, useDeleteWorkspace } from "@/stores/workspaces";
import { useNavigationStore } from "@/stores/navigation";
import { isPersonalWorkspace, SPECIAL_DIRS } from "@/lib/desk/constants";
import { toast } from "sonner";
import { ColorPicker } from "@/components/ui/color-picker";
import type { Workspace } from "@/types";

interface EditWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
  workspace: Workspace;
}

export function EditWorkspaceModal({ open, onClose, workspace }: EditWorkspaceModalProps) {
  const updateWorkspace = useUpdateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const setCurrentWorkspaceId = useNavigationStore((state) => state.setCurrentWorkspaceId);

  const isPersonal = isPersonalWorkspace(workspace.id);

  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || "");
  const [color, setColor] = useState(workspace.color || "#3b82f6");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync form state when workspace prop changes
  useEffect(() => {
    setName(workspace.name);
    setDescription(workspace.description || "");
    setColor(workspace.color || "#3b82f6");
  }, [workspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    try {
      await updateWorkspace.mutateAsync({
        workspaceId: workspace.id,
        updates: {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
        },
      });
      toast.success("Workspace updated");
      onClose();
    } catch (error) {
      console.error("Failed to update workspace:", error);
      toast.error("Failed to update workspace");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteWorkspace.mutateAsync(workspace.id);
      toast.success(`Workspace "${workspace.name}" deleted`);
      setCurrentWorkspaceId(SPECIAL_DIRS.PERSONAL);
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error("Failed to delete workspace:", error);
      toast.error("Failed to delete workspace");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
            <DialogDescription className="sr-only">Edit workspace settings</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <FormField id="edit-workspace-name" label="Workspace Name">
              <Input
                id="edit-workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Client Name"
                disabled={isPersonal}
                autoFocus={!isPersonal}
              />
              {isPersonal && (
                <p className="text-xs text-muted-foreground mt-1">
                  Personal workspace name cannot be changed.
                </p>
              )}
            </FormField>

            <FormField id="edit-workspace-description" label="Description" optional>
              <Textarea
                id="edit-workspace-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this workspace..."
                className="min-h-[80px] resize-none"
                autoFocus={isPersonal}
              />
            </FormField>

            <FormField label="Color">
              <ColorPicker value={color} onChange={setColor} />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={(!isPersonal && !name.trim()) || updateWorkspace.isPending}>
                {updateWorkspace.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </div>

            {!isPersonal && (
              <>
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-medium text-destructive mb-2">Danger Zone</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Permanently delete this workspace and all its projects, tasks, docs, and meetings.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Workspace
                  </Button>
                </div>
              </>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Workspace"
        description={`This will permanently delete "${workspace.name}" and all its projects, tasks, docs, and meetings. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
