"use client";

import { useState } from "react";
import { Header } from "@/components/layout";
import { KanbanBoard, TaskDetailPanel, QuickAddTask } from "@/components/tasks";
import type { Task } from "@/types";

export default function Home() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="All Tasks"
        action={{
          label: "New Task",
          onClick: () => setShowNewTask(true),
        }}
      />
      <div className="flex-1 p-6 overflow-hidden">
        <KanbanBoard onTaskClick={handleTaskClick} />
      </div>

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />

      {/* Quick Add Task Modal */}
      <QuickAddTask
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
      />
    </div>
  );
}
