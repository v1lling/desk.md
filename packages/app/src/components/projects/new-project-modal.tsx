
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { useCreateProject, useCurrentWorkspace } from "@/stores";
import type { ProjectStatus } from "@desk/core/types";
import { toast } from "sonner";

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
}

const statusValues: ProjectStatus[] = ["active", "paused"];

export function NewProjectModal({ open, onClose }: NewProjectModalProps) {
  const { t } = useTranslation();
  const currentWorkspace = useCurrentWorkspace();
  const createProject = useCreateProject();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !currentWorkspace) return;

    try {
      await createProject.mutateAsync({
        workspaceId: currentWorkspace.id,
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      });

      toast.success(t("toasts.project.create.success"));

      // Reset form
      setName("");
      setDescription("");
      setStatus("active");
      onClose();
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error(t("toasts.project.create.error"));
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setStatus("active");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("modals.newProject.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("modals.newProject.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FormField id="project-name" label={t("modals.newProject.nameLabel")}>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("modals.newProject.namePlaceholder")}
              autoFocus
            />
          </FormField>

          <FormField id="project-description" label={t("modals.newProject.descriptionLabel")} optional>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("modals.newProject.descriptionPlaceholder")}
              className="min-h-[80px] resize-none"
            />
          </FormField>

          <FormField label={t("modals.newProject.statusLabel")}>
            <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`entities.project.status.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              {t("common.buttons.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || !currentWorkspace || createProject.isPending}>
              {createProject.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("modals.newProject.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
