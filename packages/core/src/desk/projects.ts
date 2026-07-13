/**
 * Projects library - File system operations for projects
 */
import type { Project, ProjectStatus, ProjectUpdate } from "../types";
import { parseMarkdown, serializeMarkdown, slugify, todayISO, normalizeDate, clearNulls } from "./parser";
import { isMockMode, getDeskPath, joinPath } from "./env";
import { getStorage } from "./storage";
import { mockProjects } from "./mock-data";
import { SPECIAL_DIRS, PATH_SEGMENTS } from "./constants";
import { ensureProjectBrief, hasSeedContent, type BriefSeed } from "./project-brief";

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
  if (isMockMode()) {
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

        // Count project content (context/ + docs/ together — both surface in the tree)
        const taskStats = await countProjectTasks(projectPath);
        const docsPath = await joinPath(projectPath, PATH_SEGMENTS.DOCS);
        const contextPath = await joinPath(projectPath, PATH_SEGMENTS.CONTEXT);
        const meetingsPath = await joinPath(projectPath, PATH_SEGMENTS.MEETINGS);
        const [humanDocCount, aiDocCount, meetingCount] = await Promise.all([
          countMarkdownFiles(docsPath, true),
          countMarkdownFiles(contextPath, true),
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
  if (isMockMode()) {
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

    // Count project content (context/ + docs/ together — both surface in the tree)
    const taskStats = await countProjectTasks(projectPath);
    const docsPath = await joinPath(projectPath, PATH_SEGMENTS.DOCS);
    const contextPath = await joinPath(projectPath, PATH_SEGMENTS.CONTEXT);
    const meetingsPath = await joinPath(projectPath, PATH_SEGMENTS.MEETINGS);
    const [humanDocCount, aiDocCount, meetingCount] = await Promise.all([
      countMarkdownFiles(docsPath, true),
      countMarkdownFiles(contextPath, true),
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
  /**
   * Seeds `context/<date>-brief.md`. The forcing function for the map: a project's intent and
   * the systems it touches cannot be derived from its records later, so they are captured at
   * birth or not at all. Omitted or empty on both fields → no brief is written, because an
   * empty brief of bare headings looks done and is noise to an agent. Project Home then shows
   * the "Write the brief" call to action instead.
   */
  seed?: BriefSeed;
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

  const seed: BriefSeed = { description: data.description, ...data.seed };

  if (isMockMode()) {
    mockProjects.push(project);
    if (hasSeedContent(seed)) {
      await ensureProjectBrief({
        workspaceId: data.workspaceId,
        projectId: id,
        projectName: project.name,
        seed,
      });
    }
    return project;
  }

  const deskPath = await getDeskPath();
  const projectPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, data.workspaceId, PATH_SEGMENTS.PROJECTS, id);

  // Create project directory structure
  await getStorage().mkdir(projectPath);
  await getStorage().mkdir(await joinPath(projectPath, PATH_SEGMENTS.TASKS));
  await getStorage().mkdir(await joinPath(projectPath, PATH_SEGMENTS.DOCS));
  await getStorage().mkdir(await joinPath(projectPath, PATH_SEGMENTS.CONTEXT));

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

  if (hasSeedContent(seed)) {
    await ensureProjectBrief({
      workspaceId: data.workspaceId,
      projectId: id,
      projectName: project.name,
      seed,
    });
  }

  return project;
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: ProjectUpdate,
  workspaceId?: string
): Promise<Project | null> {
  if (isMockMode()) {
    const index = mockProjects.findIndex((p) => p.id === projectId);
    if (index === -1) return null;
    mockProjects[index] = { ...mockProjects[index], ...clearNulls(updates) };
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
      // null clears the field (→ undefined → dropped by serializeMarkdown); undefined leaves it.
      ...(updates.description !== undefined && { description: updates.description ?? undefined }),
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
  if (isMockMode()) {
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
