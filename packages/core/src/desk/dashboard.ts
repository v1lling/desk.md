/**
 * Dashboard library - Cross-workspace data aggregation
 *
 * Provides functions to fetch data across all workspaces for the dashboard view.
 */

import type { Task } from "../types";
import { compareDatesDesc } from "./parser";
import { getWorkspaces } from "./workspaces";
import { getTasks } from "./tasks";
import { getProjects } from "./projects";
import { getHighlightedTasks } from "./view-state";
import { getCaptureTasks } from "./personal";

/**
 * Summary data for a workspace (used in dashboard)
 */
export interface WorkspaceSummary {
  workspaceId: string;
  name: string;
  color?: string;
  totalTasks: number;
  backlogTasks: number;
  completedTasks: number;
  doingTasks: number;
  /**
   * todo + doing + waiting — the work actually in flight.
   *
   * There is deliberately no completion percentage here. `done / total` treats "tasks I have
   * written down so far" as the denominator, so capturing a new task makes a workspace look
   * *less* finished. A count has no denominator and cannot lie.
   */
  activeTasks: number;
}

/**
 * Active task with workspace context
 */
export interface ActiveTask extends Task {
  workspaceName: string;
  workspaceColor?: string;
}

/**
 * Get all tasks highlighted "for focus" across every workspace.
 *
 * Highlights are stored per view-state scope — once at workspace level
 * (the All Tasks board) and once per project — so every scope is scanned
 * and the collected IDs are resolved against that workspace's tasks.
 *
 * Completed tasks are excluded: a finished task is no longer "focus" even
 * if its highlight was never cleared.
 */
export async function getFocusTasks(): Promise<ActiveTask[]> {
  const workspaces = await getWorkspaces();

  const perWorkspace = await Promise.all(
    workspaces.map(async (workspace) => {
      const [projects, tasks] = await Promise.all([
        getProjects(workspace.id),
        getTasks(workspace.id),
      ]);

      const idLists = await Promise.all([
        getHighlightedTasks(workspace.id, null),
        ...projects.map((project) => getHighlightedTasks(workspace.id, project.id)),
      ]);
      const highlightedIds = new Set(idLists.flat());

      return tasks
        .filter((task) => task.status !== "done" && highlightedIds.has(task.id))
        .map((task) => ({
          ...task,
          workspaceName: workspace.name,
          workspaceColor: workspace.color,
        }));
    })
  );

  const focusTasks = perWorkspace.flat();

  // Sort by created date (most recent first)
  focusTasks.sort((a, b) => compareDatesDesc(a.created, b.created));

  return focusTasks;
}

/**
 * Get summary statistics for all workspaces
 */
export async function getWorkspaceSummaries(): Promise<WorkspaceSummary[]> {
  const workspaces = await getWorkspaces();
  const summaries: WorkspaceSummary[] = [];

  // Fetch task counts from all workspaces in parallel
  const summaryPromises = workspaces.map(async (workspace) => {
    const tasks = await getTasks(workspace.id);

    const totalTasks = tasks.length;
    const backlogTasks = tasks.filter((t) => t.status === "backlog").length;
    const completedTasks = tasks.filter((t) => t.status === "done").length;
    const doingTasks = tasks.filter((t) => t.status === "doing").length;
    const activeTasks = tasks.filter(
      (t) => t.status === "todo" || t.status === "doing" || t.status === "waiting",
    ).length;

    return {
      workspaceId: workspace.id,
      name: workspace.name,
      color: workspace.color,
      totalTasks,
      backlogTasks,
      completedTasks,
      doingTasks,
      activeTasks,
    };
  });

  const results = await Promise.all(summaryPromises);
  summaries.push(...results);

  // Busiest workspace first.
  summaries.sort((a, b) => b.activeTasks - a.activeTasks);

  return summaries;
}

// Note: Personal summary is now included in workspace summaries since Personal is a workspace

/**
 * Get ALL tasks across all workspaces (all statuses).
 *
 * The planner's single task query: its blocks need done/backlog tasks too (a task finished
 * after it was planned stays visible, struck through), and the unscheduled rail's set is a
 * plain filter of this one.
 */
export async function getAllWorkspaceTasksAllStatuses(): Promise<ActiveTask[]> {
  return getAllWorkspaceTasksByStatus();
}

/**
 * Internal: fetch cross-workspace tasks, optionally filtered by status.
 * When no statuses provided, returns all tasks.
 */
async function getAllWorkspaceTasksByStatus(
  statuses?: string[]
): Promise<ActiveTask[]> {
  const workspaces = await getWorkspaces();
  const allTasks: ActiveTask[] = [];

  const workspaceTasksPromises = workspaces.map(async (workspace) => {
    const tasks = await getTasks(workspace.id);
    const filtered = statuses
      ? tasks.filter((task) => statuses.includes(task.status))
      : tasks;
    return filtered.map((task) => ({
      ...task,
      workspaceName: workspace.name,
      workspaceColor: workspace.color,
    }));
  });

  const workspaceTasksResults = await Promise.all(workspaceTasksPromises);
  workspaceTasksResults.forEach((tasks) => allTasks.push(...tasks));

  // Also fetch capture tasks (the capture inbox lives in the home workspace)
  const homeWorkspace = workspaces.find((w) => w.isHome);
  const captureTasks = await getCaptureTasks();
  const filteredCapture = statuses
    ? captureTasks.filter((task) => statuses.includes(task.status))
    : captureTasks;
  const enrichedCapture = filteredCapture.map((task) => ({
    ...task,
    workspaceName: homeWorkspace?.name || "Home",
    workspaceColor: homeWorkspace?.color,
  }));

  allTasks.push(...enrichedCapture);
  allTasks.sort((a, b) => compareDatesDesc(a.created, b.created));

  return allTasks;
}
