"use client";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Flag, Loader2 } from "lucide-react";
import { useCreateTask, useProjects, useCurrentArea } from "@/stores";
import type { TaskPriority } from "@/types";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { toast } from "sonner";

interface QuickAddTaskProps {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: "high", label: "High", color: "text-rose-600 dark:text-rose-400" },
  { value: "medium", label: "Medium", color: "text-amber-600 dark:text-amber-400" },
  { value: "low", label: "Low", color: "text-emerald-600 dark:text-emerald-400" },
];

export function QuickAddTask({ open, onClose, defaultProjectId }: QuickAddTaskProps) {
  const currentArea = useCurrentArea();
  const createTask = useCreateTask();
  const { data: projects = [] } = useProjects(currentArea?.id || null);

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "none">("none");
  const [due, setDue] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || "");

  // Set default project when projects load
  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(defaultProjectId || projects[0].id);
    }
  }, [projects, projectId, defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !currentArea) return;

    try {
      await createTask.mutateAsync({
        areaId: currentArea.id,
        projectId,
        title: title.trim(),
        priority: priority === "none" ? undefined : priority,
        due: due || undefined,
        content,
      });

      toast.success("Task created");

      // Reset form
      setTitle("");
      setPriority("none");
      setDue("");
      setContent("");
      onClose();
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error("Failed to create task");
    }
  };

  const handleClose = () => {
    setTitle("");
    setPriority("none");
    setDue("");
    setContent("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="new-title">Title</Label>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          {/* Project */}
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
                <SelectItem value="_inbox">Inbox (no project)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority & Due row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority | "none")}
              >
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-due">Due Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-due"
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Notes (optional) */}
          <div className="space-y-2">
            <Label htmlFor="new-content">Notes (optional)</Label>
            <Textarea
              id="new-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add details..."
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Actions */}
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
