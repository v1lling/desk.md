"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout";
import {
  usePersonalTasks,
  useCreatePersonalTask,
  usePersonalViewMode,
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
import { TaskDetailPanel, TaskListView, KanbanBoard } from "@/components/tasks";
import { EntityFilterBar } from "@/components/ui/entity-filter-bar";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";

const priorityOptions = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function PersonalTasksPage() {
  const { data: tasks = [], isLoading } = usePersonalTasks();
  const createTask = useCreatePersonalTask();
  const { viewMode, setViewMode } = usePersonalViewMode();

  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
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
    setSelectedTask(task);
  };

  const handleCloseDetail = () => {
    setSelectedTask(null);
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

      {/* Filter bar with priority filter and view toggle */}
      <EntityFilterBar
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
        rightElement={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
      />

      <main className="flex-1 overflow-auto p-6">
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

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={!!selectedTask}
        onClose={handleCloseDetail}
      />
    </div>
  );
}
