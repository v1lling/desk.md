import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { useUpdateWorkspace, useDeleteWorkspace, useHomeWorkspace } from "@/stores/workspaces";
import { useNavigationStore } from "@/stores/navigation";
import { toast } from "sonner";
import { ColorPicker } from "@/components/ui/color-picker";
import type { Workspace } from "@/types";

interface EditWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
  workspace: Workspace;
}

export function EditWorkspaceModal({ open, onClose, workspace }: EditWorkspaceModalProps) {
  const { t } = useTranslation();
  const updateWorkspace = useUpdateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const setCurrentWorkspaceId = useNavigationStore((state) => state.setCurrentWorkspaceId);
  const homeWorkspace = useHomeWorkspace();

  const isHome = workspace.isHome === true;

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
      toast.success(t("toasts.workspace.update.success"));
      onClose();
    } catch (error) {
      console.error("Failed to update workspace:", error);
      toast.error(t("toasts.workspace.update.error"));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteWorkspace.mutateAsync(workspace.id);
      toast.success(t("toasts.workspace.delete.success", { name: workspace.name }));
      if (homeWorkspace) {
        setCurrentWorkspaceId(homeWorkspace.id);
      }
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error("Failed to delete workspace:", error);
      toast.error(t("toasts.workspace.delete.error"));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("modals.editWorkspace.title")}</DialogTitle>
            <DialogDescription className="sr-only">{t("modals.editWorkspace.description")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <FormField id="edit-workspace-name" label={t("modals.editWorkspace.nameLabel")}>
              <Input
                id="edit-workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("modals.editWorkspace.namePlaceholder")}
                autoFocus
              />
            </FormField>

            <FormField id="edit-workspace-description" label={t("modals.editWorkspace.descriptionLabel")} optional>
              <Textarea
                id="edit-workspace-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("modals.editWorkspace.descriptionPlaceholder")}
                className="min-h-[80px] resize-none"
              />
            </FormField>

            <FormField label={t("modals.editWorkspace.colorLabel")}>
              <ColorPicker value={color} onChange={setColor} />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common.buttons.cancel")}
              </Button>
              <Button type="submit" disabled={!name.trim() || updateWorkspace.isPending}>
                {updateWorkspace.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.buttons.save")}
              </Button>
            </div>

            {isHome ? (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  {t("modals.editWorkspace.homeNote")}
                </p>
              </div>
            ) : (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium text-destructive mb-2">{t("modals.editWorkspace.dangerZone")}</p>
                <p className="text-sm text-muted-foreground mb-3">
                  {t("modals.editWorkspace.deleteNote")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  {t("modals.editWorkspace.deleteButton")}
                </Button>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t("modals.editWorkspace.deleteConfirmTitle")}
        description={t("modals.editWorkspace.deleteConfirmDescription", { name: workspace.name })}
        confirmLabel={t("common.buttons.delete")}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
