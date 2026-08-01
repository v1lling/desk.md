/**
 * Cross-workspace dashboard and planner aggregation.
 *
 * Dashboard reads live behind DeskService so hosted clients receive one compact
 * result instead of fanning out across every workspace over RPC.
 */

import type { Task, TaskPriority, TaskStatus } from "../types";
import { compareDatesDesc } from "./parser";
import { getWorkspaces } from "./workspaces";
import { getTasks } from "./tasks";
import { getProjects } from "./projects";
import { getMeetings } from "./meetings";
import { getDocs } from "./content";
import { getHighlightedTasks } from "./view-state";
import { getCaptureTasks } from "./personal";
import { getScopedEntityKey } from "./entity-identity";

export interface DashboardOverviewOptions {
  /** Local calendar date supplied by the client, formatted as YYYY-MM-DD. */
  today: string;
  /** Number of recent-work rows to return. Defaults to 5 and is capped at 20. */
  recentLimit?: number;
}

/** A content-free task projection for calm dashboard lists and small RPC payloads. */
export interface DashboardTaskItem {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  workspaceColor?: string;
  projectId: string;
  projectName?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  due?: string;
  created?: string;
  updated?: string;
}

export type RecentWorkKind = "task" | "doc" | "meeting";

export interface RecentWorkItem {
  kind: RecentWorkKind;
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  workspaceColor?: string;
  projectId: string;
  projectName?: string;
  activityAt: string;
}

export interface DashboardOverview {
  focusTasks: DashboardTaskItem[];
  dueTasks: DashboardTaskItem[];
  recentWork: RecentWorkItem[];
}

/** Active task with workspace context, used by the week planner. */
export interface ActiveTask extends Task {
  workspaceName: string;
  workspaceColor?: string;
}

const priorityRank: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function taskPriorityRank(task: Pick<DashboardTaskItem, "priority">): number {
  return task.priority ? priorityRank[task.priority] : 3;
}

function compareFocusTasks(a: DashboardTaskItem, b: DashboardTaskItem): number {
  const due = (a.due ?? "9999-99-99").localeCompare(b.due ?? "9999-99-99");
  if (due !== 0) return due;

  const priority = taskPriorityRank(a) - taskPriorityRank(b);
  if (priority !== 0) return priority;

  const activity = compareDatesDesc(a.updated ?? a.created, b.updated ?? b.created);
  return activity || a.title.localeCompare(b.title);
}

function compareDueTasks(a: DashboardTaskItem, b: DashboardTaskItem): number {
  const due = (a.due ?? "").localeCompare(b.due ?? "");
  if (due !== 0) return due;

  const priority = taskPriorityRank(a) - taskPriorityRank(b);
  return priority || a.title.localeCompare(b.title);
}

function toDashboardTask(
  task: Task,
  workspace: { id: string; name: string; color?: string },
  projectNames: Map<string, string>,
): DashboardTaskItem {
  return {
    id: task.id,
    title: task.title,
    workspaceId: task.workspaceId,
    workspaceName: workspace.name,
    workspaceColor: workspace.color,
    projectId: task.projectId,
    projectName: projectNames.get(task.projectId),
    status: task.status,
    priority: task.priority,
    due: task.due,
    created: task.created,
    updated: task.updated,
  };
}

function isHighlighted(
  task: Task,
  workspaceHighlights: Set<string>,
  projectHighlights: Map<string, Set<string>>,
): boolean {
  const scopedKey = getScopedEntityKey(task);
  const inWorkspace = workspaceHighlights.has(scopedKey) || workspaceHighlights.has(task.id);
  const projectSet = projectHighlights.get(task.projectId);
  const inProject = projectSet?.has(scopedKey) || projectSet?.has(task.id) || false;
  return inWorkspace || inProject;
}

/**
 * Fetch the complete compact dashboard overview in one domain call.
 *
 * `today` comes from the UI so due-date behavior follows the user's local day
 * even when the domain runs on a server in another timezone.
 */
export async function getDashboardOverview(
  options: DashboardOverviewOptions,
): Promise<DashboardOverview> {
  const recentLimit = Math.min(Math.max(Math.floor(options.recentLimit ?? 5), 1), 20);
  const workspaces = await getWorkspaces();

  const perWorkspace = await Promise.all(
    workspaces.map(async (workspace) => {
      const [projects, tasks, docs, meetings] = await Promise.all([
        getProjects(workspace.id),
        getTasks(workspace.id),
        getDocs(workspace.id),
        getMeetings(workspace.id),
      ]);
      const projectNames = new Map(projects.map((project) => [project.id, project.name]));

      const [workspaceHighlightIds, ...projectHighlightIds] = await Promise.all([
        getHighlightedTasks(workspace.id, null),
        ...projects.map((project) => getHighlightedTasks(workspace.id, project.id)),
      ]);
      const workspaceHighlights = new Set(workspaceHighlightIds);
      const projectHighlights = new Map(
        projects.map((project, index) => [project.id, new Set(projectHighlightIds[index])]),
      );

      const projectedTasks = tasks.map((task) =>
        toDashboardTask(task, workspace, projectNames),
      );
      const focusTasks = tasks
        .filter(
          (task) => task.status !== "done" && isHighlighted(task, workspaceHighlights, projectHighlights),
        )
        .map((task) => toDashboardTask(task, workspace, projectNames));
      const dueTasks = projectedTasks.filter(
        (task) => task.status !== "done" && task.due !== undefined && task.due <= options.today,
      );

      const recentWork: RecentWorkItem[] = [];
      const addRecent = (
        kind: RecentWorkKind,
        item: { id: string; title: string; projectId: string; updated?: string; created?: string },
      ) => {
        const activityAt = item.updated ?? item.created;
        if (!activityAt) return;
        recentWork.push({
          kind,
          id: item.id,
          title: item.title,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          workspaceColor: workspace.color,
          projectId: item.projectId,
          projectName: projectNames.get(item.projectId),
          activityAt,
        });
      };

      for (const task of tasks) addRecent("task", task);
      for (const doc of docs) addRecent("doc", doc);
      for (const meeting of meetings) {
        if (!meeting.date || meeting.date <= options.today) addRecent("meeting", meeting);
      }

      return { focusTasks, dueTasks, recentWork };
    }),
  );

  const focusTasks = perWorkspace.flatMap((result) => result.focusTasks).sort(compareFocusTasks);
  const dueTasks = perWorkspace.flatMap((result) => result.dueTasks).sort(compareDueTasks);
  const recentWork = perWorkspace
    .flatMap((result) => result.recentWork)
    .sort(
      (a, b) =>
        compareDatesDesc(a.activityAt, b.activityAt)
        || a.kind.localeCompare(b.kind)
        || a.title.localeCompare(b.title),
    )
    .slice(0, recentLimit);

  return { focusTasks, dueTasks, recentWork };
}

/**
 * Get every task from every workspace for the planner, including capture and
 * completed/backlog tasks so scheduled blocks never lose their referenced task.
 */
export async function getAllWorkspaceTasksAllStatuses(): Promise<ActiveTask[]> {
  const workspaces = await getWorkspaces();
  const allTasks: ActiveTask[] = [];

  const workspaceTasksResults = await Promise.all(
    workspaces.map(async (workspace) => {
      const tasks = await getTasks(workspace.id);
      return tasks.map((task) => ({
        ...task,
        workspaceName: workspace.name,
        workspaceColor: workspace.color,
      }));
    }),
  );
  workspaceTasksResults.forEach((tasks) => allTasks.push(...tasks));

  const homeWorkspace = workspaces.find((workspace) => workspace.isHome);
  const captureTasks = await getCaptureTasks();
  allTasks.push(
    ...captureTasks.map((task) => ({
      ...task,
      workspaceName: homeWorkspace?.name || "Home",
      workspaceColor: homeWorkspace?.color,
    })),
  );

  allTasks.sort((a, b) => compareDatesDesc(a.created, b.created));
  return allTasks;
}
