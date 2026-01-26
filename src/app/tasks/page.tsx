"use client";

import { useState, useMemo } from "react";
import { KanbanBoard, QuickAddTask, TaskListView } from "@/components/tasks";
import { FilteredListPage } from "@/components/patterns";
import { useTasks, useCurrentWorkspace, useViewMode, useOpenTab } from "@/stores";
import { useProjectName, useOpenFromQuery } from "@/hooks";
import type { Task } from "@/types";

export default function TasksPage() {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: tasks = [] } = useTasks(currentWorkspaceId);
  const { projects, getProjectName } = useProjectName(currentWorkspaceId);

  // View mode for All Tasks (workspace-level, projectId = null)
  const { viewMode, setViewMode } = useViewMode(currentWorkspaceId, null, "kanban");
  const { openTask } = useOpenTab();

  const [showNewTask, setShowNewTask] = useState(false);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  // Handle ?open= query param from search navigation
  useOpenFromQuery(tasks, openTask, "/tasks");

  const handleTaskClick = (task: Task) => {
    openTask(task);
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
    <FilteredListPage
      actionLabel="New Task"
      onAction={() => setShowNewTask(true)}
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
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      modal={
        <QuickAddTask
          open={showNewTask}
          onClose={() => setShowNewTask(false)}
        />
      }
    >
      {viewMode === "kanban" ? (
        <KanbanBoard
          onTaskClick={handleTaskClick}
          showProject
          tasks={filteredTasks}
        />
      ) : (
        <TaskListView
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
          showProject
          getProjectName={getProjectName}
          groupByStatus
        />
      )}
    </FilteredListPage>
  );
}
