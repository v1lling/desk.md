"use client";

import { useState } from "react";
import { Header } from "@/components/layout";
import { TaskCard } from "@/components/tasks";
import {
  useInboxTasks,
  useCreateInboxTask,
  useMoveFromInbox,
  useUpdatePersonalTask,
  useDeletePersonalTask,
} from "@/stores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ArrowRight, Trash2 } from "lucide-react";
import type { Task } from "@/types";

export default function InboxPage() {
  const { data: tasks = [], isLoading } = useInboxTasks();
  const createTask = useCreateInboxTask();
  const moveFromInbox = useMoveFromInbox();
  const updateTask = useUpdatePersonalTask();
  const deleteTask = useDeletePersonalTask();

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    await createTask.mutateAsync({ title: newTaskTitle.trim() });
    setNewTaskTitle("");
  };

  const handleMoveToTasks = async (taskId: string) => {
    await moveFromInbox.mutateAsync(taskId);
  };

  const handleDelete = async (taskId: string) => {
    await deleteTask.mutateAsync(taskId);
  };

  const handleStatusChange = async (taskId: string, status: Task["status"]) => {
    await updateTask.mutateAsync({ taskId, updates: { status } });
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Inbox" subtitle="Quick capture for items to triage later" />

      <main className="flex-1 overflow-auto p-6">
        {/* Quick Add Form */}
        <form onSubmit={handleQuickAdd} className="mb-6">
          <div className="flex gap-2">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Quick add a task..."
              className="flex-1"
            />
            <Button type="submit" disabled={!newTaskTitle.trim()}>
              <Plus className="size-4 mr-2" />
              Add
            </Button>
          </div>
        </form>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">
              Loading inbox...
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">Your inbox is empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Use quick add above to capture tasks for later triage
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 p-3 rounded-lg border bg-card"
              >
                <div className="flex-1">
                  <TaskCard
                    task={task}
                    onClick={() => setSelectedTask(task)}
                    showProject={false}
                  />
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMoveToTasks(task.id)}
                    title="Move to Personal Tasks"
                  >
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(task.id)}
                    className="text-destructive hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
