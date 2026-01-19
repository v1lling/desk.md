"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout";
import {
  usePersonalTasks,
  useCreatePersonalTask,
  useUpdatePersonalTask,
  useDeletePersonalTask,
  groupPersonalTasksByStatus,
} from "@/stores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, CheckCircle2, Circle, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types";

const statusConfig: Record<
  TaskStatus,
  { label: string; icon: typeof Circle; color: string }
> = {
  todo: { label: "To Do", icon: Circle, color: "text-muted-foreground" },
  doing: { label: "Doing", icon: Loader2, color: "text-blue-500" },
  waiting: { label: "Waiting", icon: Clock, color: "text-amber-500" },
  done: { label: "Done", icon: CheckCircle2, color: "text-emerald-500" },
};

export default function PersonalTasksPage() {
  const { data: tasks = [], isLoading } = usePersonalTasks();
  const createTask = useCreatePersonalTask();
  const updateTask = useUpdatePersonalTask();
  const deleteTask = useDeletePersonalTask();

  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");

  const groupedTasks = useMemo(() => groupPersonalTasksByStatus(tasks), [tasks]);

  const filteredTasks = useMemo(() => {
    if (filterStatus === "all") return tasks;
    return tasks.filter((t) => t.status === filterStatus);
  }, [tasks, filterStatus]);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    await createTask.mutateAsync({ title: newTaskTitle.trim() });
    setNewTaskTitle("");
    setShowNewTask(false);
  };

  const handleStatusToggle = async (task: Task) => {
    const nextStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    await updateTask.mutateAsync({ taskId: task.id, updates: { status: nextStatus } });
  };

  // Count active tasks (not done)
  const activeCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Personal Tasks"
        subtitle={`${activeCount} active task${activeCount !== 1 ? "s" : ""}`}
        action={{
          label: "New Task",
          onClick: () => setShowNewTask(true),
        }}
      />

      {/* Filter Tabs */}
      <div className="border-b px-6 py-2">
        <div className="flex gap-2">
          <Button
            variant={filterStatus === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilterStatus("all")}
          >
            All ({tasks.length})
          </Button>
          {(Object.keys(statusConfig) as TaskStatus[]).map((status) => {
            const config = statusConfig[status];
            const count = groupedTasks[status].length;
            return (
              <Button
                key={status}
                variant={filterStatus === status ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilterStatus(status)}
              >
                <config.icon className={cn("size-3 mr-1", config.color)} />
                {config.label} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">
              Loading tasks...
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No tasks found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filterStatus !== "all"
                ? "Try a different filter or create a new task"
                : "Create your first personal task"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {filteredTasks.map((task) => {
              const config = statusConfig[task.status];
              const Icon = config.icon;
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
                    task.status === "done" && "opacity-60"
                  )}
                  onClick={() => handleStatusToggle(task)}
                >
                  <Icon className={cn("size-5 mt-0.5 shrink-0", config.color)} />
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "font-medium",
                        task.status === "done" && "line-through"
                      )}
                    >
                      {task.title}
                    </p>
                    {task.content && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {task.content}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* New Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Personal Task</DialogTitle>
          </DialogHeader>
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Task title..."
            onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTask(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={!newTaskTitle.trim()}>
              <Plus className="size-4 mr-2" />
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
