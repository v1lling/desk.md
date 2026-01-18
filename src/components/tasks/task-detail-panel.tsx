"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Calendar, Flag, FolderKanban } from "lucide-react";
import { useUpdateTask, useDeleteTask, useMoveTaskToProject, useProjects, useRemoveTaskFromOrder } from "@/stores";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SPECIAL_DIRS } from "@/lib/orbit/constants";
import { priorityTextColors } from "@/lib/design-tokens";

interface TaskDetailPanelProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "doing", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
];

const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
  { value: "high", label: "High", color: priorityTextColors.high },
  { value: "medium", label: "Medium", color: priorityTextColors.medium },
  { value: "low", label: "Low", color: priorityTextColors.low },
];

export function TaskDetailPanel({ task, open, onClose }: TaskDetailPanelProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const moveTaskToProject = useMoveTaskToProject();
  const removeTaskFromOrder = useRemoveTaskFromOrder();
  const { data: projects = [] } = useProjects(task?.areaId || null);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority | "none">("none");
  const [due, setDue] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState("");

  // Project options for dropdown
  const projectOptions = useMemo(
    () => [
      { value: SPECIAL_DIRS.UNASSIGNED, label: "No project" },
      ...projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects]
  );

  // Sync state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setStatus(task.status);
      setPriority(task.priority || "none");
      setDue(task.due || "");
      setContent(task.content);
      setProjectId(task.projectId);
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;

    // If project changed, move the file first
    if (projectId !== task.projectId) {
      moveTaskToProject.mutate(
        {
          taskId: task.id,
          areaId: task.areaId,
          fromProjectId: task.projectId,
          toProjectId: projectId,
        },
        {
          onSuccess: (movedTask) => {
            // Now update other fields if needed
            if (movedTask) {
              updateTask.mutate(
                {
                  taskId: task.id,
                  areaId: task.areaId,
                  projectId: projectId,
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
            }
          },
          onError: () => toast.error("Failed to move task"),
        }
      );
    } else {
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
    }
    onClose();
  };

  const handleDelete = () => {
    if (!task) return;

    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate(
        { taskId: task.id, areaId: task.areaId, projectId: task.projectId },
        {
          onSuccess: () => {
            // Clean up view state ordering
            removeTaskFromOrder.mutate({
              areaId: task.areaId,
              projectId: task.projectId,
              taskId: task.id,
            });
            toast.success("Task deleted");
          },
          onError: () => toast.error("Failed to delete task"),
        }
      );
      onClose();
    }
  };

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col px-0">
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

          {/* Project & Due Date row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  {projectOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <FolderKanban className="h-3 w-3 text-muted-foreground" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="Add notes, details, or checklist items..."
              minHeight="200px"
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
