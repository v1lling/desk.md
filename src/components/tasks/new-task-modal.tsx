
import { useState } from "react";
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
import { Flag, Loader2 } from "lucide-react";
import { DateField } from "@/components/ui/date-field";
import { useCreateTask, useProjects, useCurrentWorkspace, useOpenTab } from "@/stores";
import type { TaskPriority } from "@/types";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { toast } from "sonner";
import { SPECIAL_DIRS } from "@/lib/desk/constants";
import { priorityTextColors } from "@/lib/design-tokens";
import { useTemplatesStore } from "@/stores/templates";
import { resolveVariables } from "@/lib/templates";

interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: "high", label: "High", color: priorityTextColors.high },
  { value: "medium", label: "Medium", color: priorityTextColors.medium },
  { value: "low", label: "Low", color: priorityTextColors.low },
];

export function NewTaskModal({ open, onClose, defaultProjectId }: NewTaskModalProps) {
  const currentWorkspace = useCurrentWorkspace();
  const createTask = useCreateTask();
  const { data: projects = [] } = useProjects(currentWorkspace?.id || null);
  const { openTask } = useOpenTab();
  const getTemplate = useTemplatesStore((s) => s.getTemplate);

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "none">("none");
  const [due, setDue] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || SPECIAL_DIRS.UNASSIGNED);

  // Set default project when provided
  useEffect(() => {
    if (defaultProjectId) {
      setProjectId(defaultProjectId);
    }
  }, [defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !currentWorkspace) return;

    try {
      const templateBody = resolveVariables(
        getTemplate("task", currentWorkspace.id),
        {
          title: title.trim(),
          date: new Date().toISOString().split("T")[0],
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

      toast.success("Task created");

      // Reset form
      setTitle("");
      setPriority("none");
      setDue("");
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
      toast.error("Failed to create task");
    }
  };

  const handleClose = () => {
    setTitle("");
    setPriority("none");
    setDue("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription className="sr-only">Create a new task in your workspace</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FormField id="new-title" label="Title">
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
          </FormField>

          <FormField label="Project" optional>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SPECIAL_DIRS.UNASSIGNED}>No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormGrid>
            <FormField label="Priority">
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority | "none")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className={cn("flex items-center gap-2", opt.color)}>
                        <Flag className="h-3 w-3" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField id="new-due" label="Due Date">
              <DateField
                id="new-due"
                value={due}
                onChange={setDue}
                placeholder="No due date"
              />
            </FormField>
          </FormGrid>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || createTask.isPending}>
              {createTask.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
