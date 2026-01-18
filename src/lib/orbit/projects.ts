/**
 * Projects library - File system operations for projects
 */
import type { Project, ProjectStatus } from "@/types";
import { parseMarkdown, serializeMarkdown, slugify, todayISO } from "./parser";
import {
  isTauri,
  getOrbitPath,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
  removeDir,
  joinPath,
  exists,
} from "./tauri-fs";

// Mock projects for browser development
let mockProjects: Project[] = [
  {
    id: "slskey",
    areaId: "slsp",
    name: "SLSKey",
    status: "active",
    description: "Swiss Library Service Key authentication system",
    created: "2024-01-01",
    taskCount: 4,
    tasksByStatus: { todo: 1, doing: 2, done: 1 },
  },
  {
    id: "alma-migration",
    areaId: "slsp",
    name: "Alma Migration",
    status: "active",
    description: "Migration of library data to Ex Libris Alma",
    created: "2024-01-05",
    taskCount: 1,
    tasksByStatus: { todo: 1, doing: 0, done: 0 },
  },
  {
    id: "api-v2",
    areaId: "slsp",
    name: "API v2",
    status: "paused",
    description: "Next generation REST API",
    created: "2023-11-15",
    taskCount: 0,
    tasksByStatus: { todo: 0, doing: 0, done: 0 },
  },
  {
    id: "main",
    areaId: "sss",
    name: "Main Project",
    status: "active",
    description: "Primary SSS development work",
    created: "2024-01-10",
    taskCount: 0,
    tasksByStatus: { todo: 0, doing: 0, done: 0 },
  },
];

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
  byStatus: { todo: number; doing: number; done: number };
}> {
  const tasksPath = await joinPath(projectPath, "tasks");

  if (!(await exists(tasksPath))) {
    return { total: 0, byStatus: { todo: 0, doing: 0, done: 0 } };
  }

  const entries = await readDir(tasksPath);
  const byStatus = { todo: 0, doing: 0, done: 0 };

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      try {
        const taskPath = await joinPath(tasksPath, entry.name);
        const content = await readTextFile(taskPath);
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
    total: byStatus.todo + byStatus.doing + byStatus.done,
    byStatus,
  };
}

/**
 * Get all projects for an area
 */
export async function getProjects(areaId: string): Promise<Project[]> {
  if (!isTauri()) {
    return mockProjects.filter((project) => project.areaId === areaId);
  }

  const orbitPath = await getOrbitPath();
  const projectsPath = await joinPath(orbitPath, "areas", areaId, "projects");

  if (!(await exists(projectsPath))) {
    return [];
  }

  const entries = await readDir(projectsPath);
  const projects: Project[] = [];

  for (const entry of entries) {
    if (entry.isDirectory && !entry.name.startsWith(".") && entry.name !== "_inbox") {
      try {
        const projectPath = await joinPath(projectsPath, entry.name);
        const projectMdPath = await joinPath(projectPath, "project.md");
        const content = await readTextFile(projectMdPath);
        const { data } = parseMarkdown<ProjectFrontmatter>(content);

        // Count tasks
        const taskStats = await countProjectTasks(projectPath);

        projects.push({
          id: entry.name,
          areaId,
          name: data.name || entry.name,
          status: data.status || "active",
          description: data.description,
          created: data.created || todayISO(),
          taskCount: taskStats.total,
          tasksByStatus: taskStats.byStatus,
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
  areaId: string,
  projectId: string
): Promise<Project | null> {
  if (!isTauri()) {
    return (
      mockProjects.find(
        (project) => project.areaId === areaId && project.id === projectId
      ) || null
    );
  }

  const orbitPath = await getOrbitPath();
  const projectPath = await joinPath(orbitPath, "areas", areaId, "projects", projectId);
  const projectMdPath = await joinPath(projectPath, "project.md");

  try {
    const content = await readTextFile(projectMdPath);
    const { data } = parseMarkdown<ProjectFrontmatter>(content);

    // Count tasks
    const taskStats = await countProjectTasks(projectPath);

    return {
      id: projectId,
      areaId,
      name: data.name || projectId,
      status: data.status || "active",
      description: data.description,
      created: data.created || todayISO(),
      taskCount: taskStats.total,
      tasksByStatus: taskStats.byStatus,
    };
  } catch {
    return null;
  }
}

/**
 * Create a new project
 */
export async function createProject(data: {
  areaId: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
}): Promise<Project> {
  const id = slugify(data.name);

  const project: Project = {
    id,
    areaId: data.areaId,
    name: data.name,
    status: data.status || "active",
    description: data.description,
    created: todayISO(),
    taskCount: 0,
    tasksByStatus: { todo: 0, doing: 0, done: 0 },
  };

  if (!isTauri()) {
    mockProjects.push(project);
    return project;
  }

  const orbitPath = await getOrbitPath();
  const projectPath = await joinPath(orbitPath, "areas", data.areaId, "projects", id);

  // Create project directory structure
  await mkdir(projectPath);
  await mkdir(await joinPath(projectPath, "tasks"));
  await mkdir(await joinPath(projectPath, "notes"));
  await mkdir(await joinPath(projectPath, "context"));

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
  await writeTextFile(await joinPath(projectPath, "project.md"), fileContent);

  return project;
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, "name" | "status" | "description">>,
  areaId?: string
): Promise<Project | null> {
  if (!isTauri()) {
    const index = mockProjects.findIndex((p) => p.id === projectId);
    if (index === -1) return null;
    mockProjects[index] = { ...mockProjects[index], ...updates };
    return mockProjects[index];
  }

  // Need areaId for file path
  if (!areaId) {
    console.warn("updateProject requires areaId in Tauri mode");
    return null;
  }

  const orbitPath = await getOrbitPath();
  const projectMdPath = await joinPath(
    orbitPath,
    "areas",
    areaId,
    "projects",
    projectId,
    "project.md"
  );

  try {
    const content = await readTextFile(projectMdPath);
    const { data, content: body } = parseMarkdown<ProjectFrontmatter>(content);

    const updatedData: ProjectFrontmatter = {
      ...data,
      ...(updates.name && { name: updates.name }),
      ...(updates.status && { status: updates.status }),
      ...(updates.description !== undefined && { description: updates.description }),
    };

    const fileContent = serializeMarkdown(updatedData, body);
    await writeTextFile(projectMdPath, fileContent);

    return {
      id: projectId,
      areaId,
      name: updatedData.name,
      status: updatedData.status,
      description: updatedData.description,
      created: updatedData.created,
      taskCount: 0,
      tasksByStatus: { todo: 0, doing: 0, done: 0 },
    };
  } catch {
    return null;
  }
}

/**
 * Delete a project (removes entire directory)
 */
export async function deleteProject(projectId: string, areaId?: string): Promise<boolean> {
  if (!isTauri()) {
    const index = mockProjects.findIndex((p) => p.id === projectId);
    if (index === -1) return false;
    mockProjects.splice(index, 1);
    return true;
  }

  if (!areaId) {
    console.warn("deleteProject requires areaId in Tauri mode");
    return false;
  }

  const orbitPath = await getOrbitPath();
  const projectPath = await joinPath(orbitPath, "areas", areaId, "projects", projectId);

  try {
    await removeDir(projectPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get project counts by status for an area
 */
export async function getProjectStats(areaId: string): Promise<{
  total: number;
  active: number;
  paused: number;
  completed: number;
  archived: number;
}> {
  const projects = await getProjects(areaId);
  return {
    total: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    paused: projects.filter((p) => p.status === "paused").length,
    completed: projects.filter((p) => p.status === "completed").length,
    archived: projects.filter((p) => p.status === "archived").length,
  };
}
