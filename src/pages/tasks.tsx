import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  KanbanBoard,
  NewTaskModal,
  TaskListView,
  StatusVisibilityToggle,
} from "@/components/tasks";
import { FilteredListPage } from "@/components/patterns";
import {
  useTasks,
  useCurrentWorkspace,
  useViewMode,
  useHiddenStatuses,
  useOpenTab,
} from "@/stores";
import { useProjectName, useOpenFromQuery } from "@/hooks";
import type { Task, TaskStatus } from "@/types";

export default function TasksPage() {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: tasks = [] } = useTasks(currentWorkspaceId);
  const { projects, getProjectName } = useProjectName(currentWorkspaceId);

  // View mode for All Tasks (workspace-level, projectId = null)
  const { viewMode, setViewMode } = useViewMode(currentWorkspaceId, null, "kanban");
  // Status visibility (persisted per-workspace, shared by kanban + list)
  const { hiddenStatuses, toggleStatus } = useHiddenStatuses(currentWorkspaceId, null);
  const { openTask } = useOpenTab();

  // Initialize project filter from ?project= URL param (e.g., from /projects page)
  const [searchParams, setSearchParams] = useSearchParams();
  const [showNewTask, setShowNewTask] = useState(false);
  const [filterProject, setFilterProject] = useState<string>(
    searchParams.get("project") || "all"
  );
  const [filterPriority, setFilterPriority] = useState<string>("all");

  // Clear URL param after initialization
  useEffect(() => {
    if (searchParams.has("project")) {
      searchParams.delete("project");
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Per-status counts for the visibility toggle pills
  const statusCounts = useMemo(() => {
    const counts: Record<TaskStatus, number> = {
      backlog: 0,
      todo: 0,
      doing: 0,
      waiting: 0,
      done: 0,
    };
    for (const task of filteredTasks) counts[task.status]++;
    return counts;
  }, [filteredTasks]);

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
        <NewTaskModal
          open={showNewTask}
          onClose={() => setShowNewTask(false)}
        />
      }
    >
      <>
        <div className="mb-3">
          <StatusVisibilityToggle
            counts={statusCounts}
            hiddenStatuses={hiddenStatuses}
            onToggle={toggleStatus}
          />
        </div>
        {viewMode === "kanban" ? (
          <KanbanBoard
            onTaskClick={handleTaskClick}
            showProject
            tasks={filteredTasks}
            hiddenStatuses={hiddenStatuses}
          />
        ) : (
          <TaskListView
            tasks={filteredTasks}
            onTaskClick={handleTaskClick}
            showProject
            getProjectName={getProjectName}
            groupByStatus
            hiddenStatuses={hiddenStatuses}
          />
        )}
      </>
    </FilteredListPage>
  );
}
