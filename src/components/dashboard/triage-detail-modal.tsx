"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check, User, FolderKanban } from "lucide-react";
import { useUpdateTask, useUpdatePersonalTask } from "@/stores";
import type { Task, TaskPriority } from "@/types";
import type { TriageDestination } from "./capture-widget";

interface TriageDetailModalProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  destination: TriageDestination | null;
}

export function TriageDetailModal({
  open,
  onClose,
  task,
  destination,
}: TriageDetailModalProps) {
  const updateTask = useUpdateTask();
  const updatePersonalTask = useUpdatePersonalTask();

  const [priority, setPriority] = useState<TaskPriority | "none">("none");
  const [content, setContent] = useState("");

  // Reset form when modal opens with new task
  useEffect(() => {
    if (open && task) {
      setPriority(task.priority || "none");
      setContent(task.content || "");
    }
  }, [open, task]);

  const handleSave = async () => {
    if (!task || !destination) return;

    const updates: { priority?: TaskPriority; content?: string } = {};

    if (priority !== "none") {
      updates.priority = priority as TaskPriority;
    }
    if (content.trim()) {
      updates.content = content.trim();
    }

    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      if (destination.type === "personal") {
        await updatePersonalTask.mutateAsync({
          taskId: task.id,
          updates,
        });
      } else if (destination.workspaceId && destination.projectId) {
        await updateTask.mutateAsync({
          taskId: task.id,
          workspaceId: destination.workspaceId,
          projectId: destination.projectId,
          updates,
        });
      }
    }

    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  const isPending = updateTask.isPending || updatePersonalTask.isPending;

  if (!task || !destination) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="size-5 text-green-500" />
            Task Moved
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <p className="font-medium text-foreground">{task.title}</p>
              <DestinationBadge destination={destination} />
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="triage-priority">Priority (optional)</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as TaskPriority | "none")}
            >
              <SelectTrigger id="triage-priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="triage-content">Notes (optional)</Label>
            <Textarea
              id="triage-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add any notes or details..."
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkip} disabled={isPending}>
            Skip
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DestinationBadge({ destination }: { destination: TriageDestination }) {
  if (destination.type === "personal") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-medium">
        <User className="size-3" />
        Personal Tasks
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
      <FolderKanban className="size-3" />
      {destination.workspaceName}
      {destination.projectName && (
        <>
          <span className="text-muted-foreground">/</span>
          {destination.projectName}
        </>
      )}
    </div>
  );
}
