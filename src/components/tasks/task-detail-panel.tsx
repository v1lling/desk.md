"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Badge } from "@/components/ui/badge";
import { Trash2, Calendar, Flag } from "lucide-react";
import { useUpdateTask, useDeleteTask } from "@/stores";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TaskDetailPanelProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "doing", label: "In Progress" },
  { value: "done", label: "Done" },
];

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: "high", label: "High", color: "text-rose-600 dark:text-rose-400" },
  { value: "medium", label: "Medium", color: "text-amber-600 dark:text-amber-400" },
  { value: "low", label: "Low", color: "text-emerald-600 dark:text-emerald-400" },
];

export function TaskDetailPanel({ task, open, onClose }: TaskDetailPanelProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority | "none">("none");
  const [due, setDue] = useState("");
  const [content, setContent] = useState("");

  // Sync state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setStatus(task.status);
      setPriority(task.priority || "none");
      setDue(task.due || "");
      setContent(task.content);
    }
  }, [task]);

  const handleSave = () => {
    if (!task) return;

    updateTask.mutate(
      {
        taskId: task.id,
        areaId: task.areaId,
        projectId: task.projectId,
        updates: {
          title,
          status,
          priority: priority === "none" ? undefined : priority,
          due: due || undefined,
          content,
        },
      },
      {
        onSuccess: () => toast.success("Task updated"),
        onError: () => toast.error("Failed to update task"),
      }
    );
    onClose();
  };

  const handleDelete = () => {
    if (!task) return;

    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate(
        { taskId: task.id, areaId: task.areaId, projectId: task.projectId },
        {
          onSuccess: () => toast.success("Task deleted"),
          onError: () => toast.error("Failed to delete task"),
        }
      );
      onClose();
    }
  };

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[400px] sm:w-[500px] flex flex-col px-0">
        <SheetHeader className="pb-4 border-b border-border/60">
          <SheetTitle>Edit Task</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 px-6 space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          {/* Status & Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
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
            </div>

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
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="due">Due Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="due"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Notes</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add notes, details, or checklist items..."
              className="min-h-[180px] resize-none"
            />
          </div>

          {/* File path (read-only info) */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/40">
            <p className="truncate font-mono" title={task.filePath}>
              {task.filePath}
            </p>
            <p className="mt-1.5">Created: {task.created}</p>
          </div>
        </div>

        {/* Actions - fixed at bottom */}
        <div className="flex gap-2 pt-4 px-6 pb-6 border-t border-border/60">
          <Button onClick={handleSave} className="flex-1">
            Save Changes
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
