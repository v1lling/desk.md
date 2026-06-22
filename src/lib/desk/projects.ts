/**
 * Projects library - File system operations for projects
 */
import type { Project, ProjectStatus } from "@/types";
import { parseMarkdown, serializeMarkdown, slugify, todayISO, normalizeDate } from "./parser";
import { isTauri, getDeskPath, joinPath } from "./env";
import { getStorage } from "./storage";
import { mockProjects } from "./mock-data";
import { SPECIAL_DIRS, PATH_SEGMENTS } from "./constants";

interface ProjectFrontmatter {
  name: string;
  status: ProjectStatus;
  description?: string;
  created: string;
}

/**
 * Count tasks in a project directory
 */
async function countProjectTasks(projectPath: string): Promise<{
  total: number;
  byStatus: { backlog: number; todo: number; doing: number; waiting: number; done: number };
}> {
  const tasksPath = await joinPath(projectPath, PATH_SEGMENTS.TASKS);

  if (!(await getStorage().exists(tasksPath))) {
    return { total: 0, byStatus: { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 0 } };
  }

  const entries = await getStorage().readDir(tasksPath);
  const byStatus = { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 0 };

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      try {
        const taskPath = await joinPath(tasksPath, entry.name);
        const content = await getStorage().readTextFile(taskPath);
        const { data } = parseMarkdown<{ status?: string }>(content);
        const status = data.status as keyof typeof byStatus;
        if (status in byStatus) {
          byStatus[status]++;
        }
      } catch {
        // Skip invalid task files
      }
    }
  }

  return {
    total: byStatus.backlog + byStatus.todo + byStatus.doing + byStatus.waiting + byStatus.done,
    byStatus,
  };
}

/**
 * Count markdown files in a directory.
 * Supports optional recursive traversal for nested docs folders.
 */
async function countMarkdownFiles(dirPath: string, recursive = false): Promise<number> {
  if (!(await getStorage().exists(dirPath))) {
    return 0;
  }

  const entries = await getStorage().readDir(dirPath);
  let count = 0;

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      count++;
    } else if (recursive && entry.isDirectory && !entry.name.startsWith(".")) {
      const childPath = await joinPath(dirPath, entry.name);
      count += await countMarkdownFiles(childPath, true);
    }
  }

  return count;
}

/**
 * Get all projects for a workspace
 */
export async function getProjects(workspaceId: string): Promise<Project[]> {
  if (!isTauri()) {
    return mockProjects.filter((project) => project.workspaceId === workspaceId);
  }

  const deskPath = await getDeskPath();
  const projectsPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS);

  if (!(await getStorage().exists(projectsPath))) {
    return [];
  }

  const entries = await getStorage().readDir(projectsPath);
  const projects: Project[] = [];

  for (const entry of entries) {
    if (entry.isDirectory && !entry.name.startsWith(".") && entry.name !== SPECIAL_DIRS.UNASSIGNED) {
      try {
        const projectPath = await joinPath(projectsPath, entry.name);
        const projectMdPath = await joinPath(projectPath, "project.md");
        const content = await getStorage().readTextFile(projectMdPath);
        const { data } = parseMarkdown<ProjectFrontmatter>(content);

        // Count project content (docs/ + ai-docs/ together — both surface in the tree)
        const taskStats = await countProjectTasks(projectPath);
        const docsPath = await joinPath(projectPath, PATH_SEGMENTS.DOCS);
        const aiDocsPath = await joinPath(projectPath, PATH_SEGMENTS.AI_DOCS);
        const meetingsPath = await joinPath(projectPath, PATH_SEGMENTS.MEETINGS);
        const [humanDocCount, aiDocCount, meetingCount] = await Promise.all([
          countMarkdownFiles(docsPath, true),
          countMarkdownFiles(aiDocsPath, true),
          countMarkdownFiles(meetingsPath),
        ]);
        const docCount = humanDocCount + aiDocCount;

        projects.push({
          id: entry.name,
          workspaceId,
          name: data.name || entry.name,
          status: data.status || "active",
          description: data.description,
          created: normalizeDate(data.created),
          taskCount: taskStats.total,
          tasksByStatus: taskStats.byStatus,
          docCount,
          meetingCount,
        });
      } catch (e) {
        console.warn(`Failed to read project ${entry.name}:`, e);
      }
    }
  }

  return projects;
}

/**
 * Get a single project by ID
 */
export async function getProject(
  workspaceId: string,
  projectId: string
): Promise<Project | null> {
  if (!isTauri()) {
    return (
      mockProjects.find(
        (project) => project.workspaceId === workspaceId && project.id === projectId
      ) || null
    );
  }

  const deskPath = await getDeskPath();
  const projectPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, projectId);
  const projectMdPath = await joinPath(projectPath, "project.md");

  try {
    const content = await getStorage().readTextFile(projectMdPath);
    const { data } = parseMarkdown<ProjectFrontmatter>(content);

    // Count project content (docs/ + ai-docs/ together — both surface in the tree)
    const taskStats = await countProjectTasks(projectPath);
    const docsPath = await joinPath(projectPath, PATH_SEGMENTS.DOCS);
    const aiDocsPath = await joinPath(projectPath, PATH_SEGMENTS.AI_DOCS);
    const meetingsPath = await joinPath(projectPath, PATH_SEGMENTS.MEETINGS);
    const [humanDocCount, aiDocCount, meetingCount] = await Promise.all([
      countMarkdownFiles(docsPath, true),
      countMarkdownFiles(aiDocsPath, true),
      countMarkdownFiles(meetingsPath),
    ]);
    const docCount = humanDocCount + aiDocCount;

    return {
      id: projectId,
      workspaceId,
      name: data.name || projectId,
      status: data.status || "active",
      description: data.description,
      created: normalizeDate(data.created),
      taskCount: taskStats.total,
      tasksByStatus: taskStats.byStatus,
      docCount,
      meetingCount,
    };
  } catch {
    return null;
  }
}

/**
 * Create a new project
 */
export async function createProject(data: {
  workspaceId: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
}): Promise<Project> {
  const id = slugify(data.name);

  const project: Project = {
    id,
    workspaceId: data.workspaceId,
    name: data.name,
    status: data.status || "active",
    description: data.description,
    created: todayISO(),
    taskCount: 0,
    tasksByStatus: { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 0 },
    docCount: 0,
    meetingCount: 0,
  };

  if (!isTauri()) {
    mockProjects.push(project);
    return project;
  }

  const deskPath = await getDeskPath();
  const projectPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, data.workspaceId, PATH_SEGMENTS.PROJECTS, id);

  // Create project directory structure
  await getStorage().mkdir(projectPath);
  await getStorage().mkdir(await joinPath(projectPath, PATH_SEGMENTS.TASKS));
  await getStorage().mkdir(await joinPath(projectPath, PATH_SEGMENTS.DOCS));
  await getStorage().mkdir(await joinPath(projectPath, PATH_SEGMENTS.AI_DOCS));

  // Create project.md
  const frontmatter: ProjectFrontmatter = {
    name: project.name,
    status: project.status,
    description: project.description,
    created: project.created,
  };

  const markdownContent = `# ${project.name}

${project.description || ""}
`;

  const fileContent = serializeMarkdown(frontmatter, markdownContent);
  await getStorage().writeTextFile(await joinPath(projectPath, "project.md"), fileContent);

  return project;
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, "name" | "status" | "description">>,
  workspaceId?: string
): Promise<Project | null> {
  if (!isTauri()) {
    const index = mockProjects.findIndex((p) => p.id === projectId);
    if (index === -1) return null;
    mockProjects[index] = { ...mockProjects[index], ...updates };
    return mockProjects[index];
  }

  // Need workspaceId for file path
  if (!workspaceId) {
    console.warn("updateProject requires workspaceId in Tauri mode");
    return null;
  }

  const deskPath = await getDeskPath();
  const projectMdPath = await joinPath(
    deskPath,
    PATH_SEGMENTS.WORKSPACES,
    workspaceId,
    PATH_SEGMENTS.PROJECTS,
    projectId,
    "project.md"
  );

  try {
    const content = await getStorage().readTextFile(projectMdPath);
    const { data, content: body } = parseMarkdown<ProjectFrontmatter>(content);

    const updatedData: ProjectFrontmatter = {
      ...data,
      ...(updates.name && { name: updates.name }),
      ...(updates.status && { status: updates.status }),
      ...(updates.description !== undefined && { description: updates.description }),
    };

    const fileContent = serializeMarkdown(updatedData, body);
    await getStorage().writeTextFile(projectMdPath, fileContent);

    return {
      id: projectId,
      workspaceId,
      name: updatedData.name,
      status: updatedData.status,
      description: updatedData.description,
      created: updatedData.created,
      taskCount: 0,
      tasksByStatus: { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 0 },
      docCount: 0,
      meetingCount: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Delete a project (removes entire directory)
 */
export async function deleteProject(projectId: string, workspaceId?: string): Promise<boolean> {
  if (!isTauri()) {
    const index = mockProjects.findIndex((p) => p.id === projectId);
    if (index === -1) return false;
    mockProjects.splice(index, 1);
    return true;
  }

  if (!workspaceId) {
    console.warn("deleteProject requires workspaceId in Tauri mode");
    return false;
  }

  const deskPath = await getDeskPath();
  const projectPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, projectId);

  try {
    await getStorage().removeDir(projectPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get project counts by status for a workspace
 */
export async function getProjectStats(workspaceId: string): Promise<{
  total: number;
  active: number;
  paused: number;
  completed: number;
  archived: number;
}> {
  const projects = await getProjects(workspaceId);
  return {
    total: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    paused: projects.filter((p) => p.status === "paused").length,
    completed: projects.filter((p) => p.status === "completed").length,
    archived: projects.filter((p) => p.status === "archived").length,
  };
}
