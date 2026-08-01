import type { TaskPriority, TaskStatus } from "../../types";
import { FILE_NAMES, PATH_SEGMENTS } from "../constants";
import { getProjects } from "../projects";
import { getWorkspaces } from "../workspaces";
import { loadAIIgnoreEntries, isPathExcludedByAIIgnore } from "../aiignore";
import { readGlobalAgentInstructions } from "../agent-instructions";
import { AgentReadError } from "./errors";
import { buildAgentCatalogSnapshot } from "./catalog";
import { runDeskSearch } from "./search";
import {
  codePoints,
  effectiveDate,
  projectRef,
  resolveAgentScope,
  workspaceRef,
} from "./shared";
import type {
  AgentCatalogEntry,
  AgentContextQuery,
  AgentContextResult,
  AgentDeskWorkspace,
  AgentOverview,
  AgentTaskGroup,
} from "./types";

const LIMITS = {
  overview_chars: 8_000,
  doing: 50,
  waiting: 50,
  todo: 20,
  recent_done: 10,
  documents: 15,
  meetings: 10,
  workspaces: 100,
  projects: 500,
} as const;

const STATUSES: TaskStatus[] = ["backlog", "todo", "doing", "waiting", "done"];

function emptyCounts(): Record<TaskStatus, number> {
  return { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 0 };
}

function taskCounts(entries: AgentCatalogEntry[]): Record<TaskStatus, number> {
  const counts = emptyCounts();
  for (const entry of entries) {
    if (entry.type === "task" && entry.status && STATUSES.includes(entry.status)) counts[entry.status] += 1;
  }
  return counts;
}

function overview(path: string, value: string | undefined, excluded: boolean): AgentOverview {
  if (excluded) {
    return { path, overview_excluded: true, total_chars: 0, returned_chars: 0, truncated: false };
  }
  const points = codePoints(value?.trim() ?? "");
  const content = points.slice(0, LIMITS.overview_chars).join("");
  return {
    path,
    content: content || undefined,
    overview_excluded: false,
    total_chars: points.length,
    returned_chars: Math.min(points.length, LIMITS.overview_chars),
    truncated: points.length > LIMITS.overview_chars,
  };
}

function dueThenRecent(a: AgentCatalogEntry, b: AgentCatalogEntry): number {
  const dueA = a.due ?? "9999-99-99";
  const dueB = b.due ?? "9999-99-99";
  return dueA.localeCompare(dueB) || effectiveDate(b).localeCompare(effectiveDate(a)) || a.path.localeCompare(b.path);
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

function todoOrder(a: AgentCatalogEntry, b: AgentCatalogEntry): number {
  const priorityA = a.priority ? PRIORITY_ORDER[a.priority] : 3;
  const priorityB = b.priority ? PRIORITY_ORDER[b.priority] : 3;
  return priorityA - priorityB || dueThenRecent(a, b);
}

function recent(a: AgentCatalogEntry, b: AgentCatalogEntry): number {
  return effectiveDate(b).localeCompare(effectiveDate(a)) || a.path.localeCompare(b.path);
}

function group(entries: AgentCatalogEntry[], status: TaskStatus, limit: number, sorter: typeof recent): AgentTaskGroup {
  const all = entries.filter((entry) => entry.type === "task" && entry.status === status).sort(sorter);
  return { total: all.length, returned: Math.min(limit, all.length), truncated: all.length > limit, entries: all.slice(0, limit) };
}

async function globalContext(): Promise<AgentContextResult> {
  const instructions = await readGlobalAgentInstructions();
  const allWorkspaces = await getWorkspaces();
  const selected = allWorkspaces.slice(0, LIMITS.workspaces);
  const result: AgentDeskWorkspace[] = [];
  let projectCount = 0;
  let totalProjects = 0;
  let truncated = allWorkspaces.length > selected.length;

  for (const workspace of selected) {
    const [projects, ignores, snapshot] = await Promise.all([
      getProjects(workspace.id),
      loadAIIgnoreEntries(workspace.id),
      buildAgentCatalogSnapshot(workspace.id),
    ]);
    const workspaceExcluded = isPathExcludedByAIIgnore(FILE_NAMES.WORKSPACE_MD, ignores);
    totalProjects += projects.length;
    truncated ||= snapshot.scanTruncated;
    const remainingProjects = Math.max(0, LIMITS.projects - projectCount);
    const includedProjects = projects.slice(0, remainingProjects);
    if (includedProjects.length < projects.length) truncated = true;
    projectCount += includedProjects.length;
    result.push({
      ...workspaceRef(workspace, workspaceExcluded),
      projects: includedProjects.map((project) => {
        const path = `${PATH_SEGMENTS.PROJECTS}/${project.id}/${FILE_NAMES.PROJECT_MD}`;
        return projectRef(project, isPathExcludedByAIIgnore(path, ignores));
      }),
      task_counts: taskCounts(snapshot.entries),
    });
  }
  return {
    scope: "desk",
    custom_instructions: instructions.content,
    custom_instructions_truncated: instructions.truncated,
    workspaces: result,
    totals: { workspaces: allWorkspaces.length, projects: totalProjects },
    limits: { workspaces: LIMITS.workspaces, projects: LIMITS.projects, custom_instructions_chars: 8_000 },
    truncated: truncated || instructions.truncated,
  };
}

export async function runDeskContext(query: AgentContextQuery = {}): Promise<AgentContextResult> {
  if (query.project && !query.workspace) {
    throw new AgentReadError("invalid_argument", "project requires workspace");
  }
  if (query.focus && query.focus.trim().length > 500) {
    throw new AgentReadError("invalid_argument", "focus cannot exceed 500 characters");
  }
  if (!query.workspace) return globalContext();

  const resolved = await resolveAgentScope(query.workspace, query.project);
  const [snapshot, ignores, instructions] = await Promise.all([
    buildAgentCatalogSnapshot(resolved.workspace.id),
    loadAIIgnoreEntries(resolved.workspace.id),
    readGlobalAgentInstructions(),
  ]);
  const projectPath = resolved.project
    ? `${PATH_SEGMENTS.PROJECTS}/${resolved.project.id}/${FILE_NAMES.PROJECT_MD}`
    : undefined;
  const workspaceExcluded = isPathExcludedByAIIgnore(FILE_NAMES.WORKSPACE_MD, ignores);
  const projectExcluded = projectPath ? isPathExcludedByAIIgnore(projectPath, ignores) : false;
  const entries = resolved.project
    ? snapshot.entries.filter((entry) => entry.project_id === resolved.project?.id)
    : snapshot.entries;
  const counts = taskCounts(entries);
  const documents = entries.filter((entry) => entry.type === "doc").sort(recent);
  const meetings = entries.filter((entry) => entry.type === "meeting").sort(recent);

  const focus = query.focus?.trim();
  if (focus) {
    const common = { query: focus, workspace: resolved.workspace.id, project: resolved.project?.id };
    const [docSearch, meetingSearch] = await Promise.all([
      runDeskSearch({ ...common, type: "doc", limit: 50 }),
      runDeskSearch({ ...common, type: "meeting", limit: 50 }),
    ]);
    const rankedDocs = new Map(docSearch.results.map((entry, index) => [entry.path, index]));
    const rankedMeetings = new Map(meetingSearch.results.map((entry, index) => [entry.path, index]));
    documents.sort((a, b) => (rankedDocs.get(a.path) ?? 10_000) - (rankedDocs.get(b.path) ?? 10_000) || recent(a, b));
    meetings.sort((a, b) => (rankedMeetings.get(a.path) ?? 10_000) - (rankedMeetings.get(b.path) ?? 10_000) || recent(a, b));
  }

  const doing = group(entries, "doing", LIMITS.doing, dueThenRecent);
  const waiting = group(entries, "waiting", LIMITS.waiting, dueThenRecent);
  const todo = group(entries, "todo", LIMITS.todo, todoOrder);
  const recentDone = group(entries, "done", LIMITS.recent_done, recent);
  const shownDocuments = documents.slice(0, LIMITS.documents);
  const shownMeetings = meetings.slice(0, LIMITS.meetings);
  const workspaceOverview = overview(FILE_NAMES.WORKSPACE_MD, resolved.workspace.overview, workspaceExcluded);
  const projectOverview = resolved.project && projectPath
    ? overview(projectPath, resolved.project.overview, projectExcluded)
    : undefined;
  const truncated = snapshot.scanTruncated || instructions.truncated || workspaceOverview.truncated ||
    Boolean(projectOverview?.truncated) || doing.truncated || waiting.truncated || todo.truncated ||
    recentDone.truncated || documents.length > shownDocuments.length || meetings.length > shownMeetings.length;

  return {
    scope: resolved.project ? "project" : "workspace",
    custom_instructions: instructions.content,
    custom_instructions_truncated: instructions.truncated,
    workspace: workspaceRef(resolved.workspace, workspaceExcluded),
    project: resolved.project ? projectRef(resolved.project, projectExcluded) : undefined,
    workspace_overview: workspaceOverview,
    project_overview: projectOverview,
    tasks: { counts, doing, waiting, todo, recent_done: recentDone },
    documents: shownDocuments,
    meetings: shownMeetings,
    totals: { documents: documents.length, meetings: meetings.length },
    limits: { ...LIMITS, custom_instructions_chars: 8_000 },
    truncated,
  };
}
