/**
 * Dashboard library - Cross-workspace data aggregation
 *
 * Provides functions to fetch data across all workspaces and personal space
 * for the dashboard view.
 */

import type { Task } from "@/types";
import { getWorkspaces } from "./workspaces";
import { getTasks } from "./tasks";
import { getAllPersonalTasks } from "./personal";
import { PERSONAL_SPACE_ID } from "./constants";

/**
 * Summary data for a workspace (used in dashboard)
 */
export interface WorkspaceSummary {
  workspaceId: string;
  name: string;
  color?: string;
  totalTasks: number;
  completedTasks: number;
  doingTasks: number;
  completionPercent: number;
}

/**
 * Active task with workspace context
 */
export interface ActiveTask extends Task {
  workspaceName: string;
  workspaceColor?: string;
}

/**
 * Get all tasks with status="doing" across all workspaces and personal space
 */
export async function getActiveTasks(): Promise<ActiveTask[]> {
  const workspaces = await getWorkspaces();
  const activeTasks: ActiveTask[] = [];

  // Fetch tasks from all workspaces in parallel
  const workspaceTasksPromises = workspaces.map(async (workspace) => {
    const tasks = await getTasks(workspace.id);
    return tasks
      .filter((task) => task.status === "doing")
      .map((task) => ({
        ...task,
        workspaceName: workspace.name,
        workspaceColor: workspace.color,
      }));
  });

  const workspaceTasksResults = await Promise.all(workspaceTasksPromises);
  workspaceTasksResults.forEach((tasks) => activeTasks.push(...tasks));

  // Also fetch personal tasks
  const personalTasks = await getAllPersonalTasks();
  const activePersonalTasks = personalTasks
    .filter((task) => task.status === "doing")
    .map((task) => ({
      ...task,
      workspaceName: "Personal",
      workspaceColor: undefined,
    }));

  activeTasks.push(...activePersonalTasks);

  // Sort by created date (most recent first)
  activeTasks.sort((a, b) => b.created.localeCompare(a.created));

  return activeTasks;
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
    const completedTasks = tasks.filter((t) => t.status === "done").length;
    const doingTasks = tasks.filter((t) => t.status === "doing").length;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      workspaceId: workspace.id,
      name: workspace.name,
      color: workspace.color,
      totalTasks,
      completedTasks,
      doingTasks,
      completionPercent,
    };
  });

  const results = await Promise.all(summaryPromises);
  summaries.push(...results);

  // Sort by number of active (non-done) tasks descending
  summaries.sort((a, b) => {
    const aActive = a.totalTasks - a.completedTasks;
    const bActive = b.totalTasks - b.completedTasks;
    return bActive - aActive;
  });

  return summaries;
}

/**
 * Get combined personal space summary
 */
export async function getPersonalSummary(): Promise<WorkspaceSummary> {
  const tasks = await getAllPersonalTasks();

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const doingTasks = tasks.filter((t) => t.status === "doing").length;
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    workspaceId: PERSONAL_SPACE_ID,
    name: "Personal",
    color: undefined,
    totalTasks,
    completedTasks,
    doingTasks,
    completionPercent,
  };
}
