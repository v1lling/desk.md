"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout";
import { KanbanBoard, TaskDetailPanel, QuickAddTask } from "@/components/tasks";
import { EntityFilterBar } from "@/components/ui/entity-filter-bar";
import { useTasks, useProjects, useCurrentArea } from "@/stores";
import type { Task } from "@/types";

export default function Home() {
  const currentArea = useCurrentArea();
  const currentAreaId = currentArea?.id || null;
  const { data: tasks = [] } = useTasks(currentAreaId);
  const { data: projects = [] } = useProjects(currentAreaId);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  // Filter tasks based on selected filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterProject !== "all" && task.projectId !== filterProject) return false;
      if (filterPriority !== "all" && task.priority !== filterPriority) return false;
      return true;
    });
  }, [tasks, filterProject, filterPriority]);

  // Prepare filter options - include "No project" for unassigned
  const projectOptions = useMemo(
    () => [
      { value: "_unassigned", label: "No project" },
      ...projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects]
  );

  const priorityOptions = [
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="All Tasks"
        action={{
          label: "New Task",
          onClick: () => setShowNewTask(true),
        }}
      />

      {/* Filter Bar */}
      <EntityFilterBar
        filters={[
          {
            id: "project",
            label: "Project",
            value: filterProject,
            onChange: setFilterProject,
            options: projectOptions,
            allLabel: "All projects",
            width: "w-[200px]",
          },
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
      />

      <div className="flex-1 p-6 min-h-0 overflow-auto">
        <KanbanBoard
          onTaskClick={handleTaskClick}
          showProject
          tasks={filteredTasks}
        />
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
