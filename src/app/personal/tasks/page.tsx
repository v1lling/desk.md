"use client";

import { useState, useMemo } from "react";
import {
  usePersonalTasks,
  useCreatePersonalTask,
  usePersonalViewMode,
  useOpenTab,
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
import { Plus } from "lucide-react";
import type { Task } from "@/types";
import { TaskListView, KanbanBoard } from "@/components/tasks";
import { FilteredListPage } from "@/components/patterns";

const priorityOptions = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function PersonalTasksPage() {
  const { data: tasks = [], isLoading } = usePersonalTasks();
  const createTask = useCreatePersonalTask();
  const { viewMode, setViewMode } = usePersonalViewMode();
  const { openTask } = useOpenTab();

  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  // Filter tasks based on priority
  const filteredTasks = useMemo(() => {
    if (filterPriority === "all") return tasks;
    return tasks.filter((t) => t.priority === filterPriority);
  }, [tasks, filterPriority]);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    await createTask.mutateAsync({ title: newTaskTitle.trim() });
    setNewTaskTitle("");
    setShowNewTask(false);
  };

  const handleTaskClick = (task: Task) => {
    openTask(task);
  };

  // Count active tasks (not done)
  const activeCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <FilteredListPage
      title="Personal Tasks"
      subtitle={`${activeCount} active task${activeCount !== 1 ? "s" : ""}`}
      actionLabel="New Task"
      onAction={() => setShowNewTask(true)}
      filters={[
        {
          id: "priority",
          label: "Priority",
          value: filterPriority,
          onChange: setFilterPriority,
          options: priorityOptions,
          allLabel: "All priorities",
          width: "w-[150px]",
        },
      ]}
      count={filteredTasks.length}
      countLabel="tasks"
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      modal={
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
      }
    >
      {viewMode === "list" ? (
        <TaskListView
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
          groupByStatus
          isLoading={isLoading}
        />
      ) : (
        <KanbanBoard
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
          isLoading={isLoading}
          isPersonal
        />
      )}
    </FilteredListPage>
  );
}
