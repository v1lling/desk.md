
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
import { FormField } from "@/components/ui/form-field";
import { FormGrid } from "@/components/ui/form-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { DateField } from "@/components/ui/date-field";
import { useCreateTask, useProjects, useCurrentWorkspace, useOpenTab } from "@/stores";
import type { TaskPriority } from "@desk/core/types";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { toast } from "sonner";
import { SPECIAL_DIRS, todayISO } from "@desk/core";
import { priorityMeta, priorityOrder } from "@/lib/design-tokens";
import { useTemplatesStore } from "@/stores/templates";
import { resolveVariables } from "@/lib/templates";

interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}

export function NewTaskModal({ open, onClose, defaultProjectId }: NewTaskModalProps) {
  const { t } = useTranslation();
  const currentWorkspace = useCurrentWorkspace();
  const createTask = useCreateTask();
  const { data: projects = [] } = useProjects(currentWorkspace?.id || null);
  const { openTask } = useOpenTab();
  const getTemplate = useTemplatesStore((s) => s.getTemplate);

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "none">("none");
  const [due, setDue] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || SPECIAL_DIRS.UNASSIGNED);

  // A dialog stays mounted while closed, so form state would otherwise leak across opens —
  // and across workspace switches, where a kept projectId points at another workspace's
  // project (the task would land in projects/<foreign-id>/, inventing a project dir with
  // no project.md). Reset the whole form on open; it is the single reset.
  useEffect(() => {
    if (open) {
      setTitle("");
      setPriority("none");
      setDue("");
      setProjectId(defaultProjectId || SPECIAL_DIRS.UNASSIGNED);
    }
  }, [open, defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !currentWorkspace) return;

    try {
      const templateBody = resolveVariables(
        getTemplate("task", currentWorkspace.id),
        {
          title: title.trim(),
          date: todayISO(),
          project: projects.find((p) => p.id === projectId)?.name || "",
          workspace: currentWorkspace.name,
        }
      );

      const task = await createTask.mutateAsync({
        workspaceId: currentWorkspace.id,
        projectId,
        title: title.trim(),
        priority: priority === "none" ? undefined : priority,
        due: due || undefined,
        templateBody: templateBody || undefined,
      });

      toast.success(t("toasts.task.created"));

      onClose();

      // Auto-open in editor tab
      openTask({
        id: task.id,
        title: task.title,
        workspaceId: task.workspaceId,
        projectId: task.projectId,
      });
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error(t("errors.task.createFailed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("modals.newTask.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("modals.newTask.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FormField id="new-title" label={t("modals.newTask.fields.title")}>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("modals.newTask.placeholders.title")}
              autoFocus
            />
          </FormField>

          <FormField label={t("modals.newTask.fields.project")} optional>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("modals.newTask.placeholders.noProject")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SPECIAL_DIRS.UNASSIGNED}>{t("modals.newTask.placeholders.noProject")}</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormGrid>
            <FormField label={t("modals.newTask.fields.priority")}>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority | "none")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("modals.newTask.placeholders.priorityNone")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("modals.newTask.placeholders.priorityNone")}</SelectItem>
                  {priorityOrder.map((p) => {
                    const { label, icon: Icon, color } = priorityMeta[p];
                    return (
                      <SelectItem key={p} value={p}>
                        <span className={cn("flex items-center gap-2", color)}>
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </FormField>

            <FormField id="new-due" label={t("modals.newTask.fields.dueDate")}>
              <DateField
                id="new-due"
                value={due}
                onChange={setDue}
                placeholder={t("modals.newTask.placeholders.noDueDate")}
              />
            </FormField>
          </FormGrid>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.buttons.cancel")}
            </Button>
            <Button type="submit" disabled={!title.trim() || createTask.isPending}>
              {createTask.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("modals.newTask.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
