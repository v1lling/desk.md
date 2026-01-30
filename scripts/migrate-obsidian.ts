/**
 * Migration script: Obsidian Projects vault → Desk
 *
 * Transforms:
 * - Projects: title → name, preserves status/created/content
 * - Tasks: task_name → title, extracts project from wiki link, preserves status/priority/created/content
 *
 * Usage: npx tsx scripts/migrate-obsidian.ts
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

const OBSIDIAN_PATH = "/Users/sascha/Obsidian/Projects";
const DESK_PATH = "/Users/sascha/Desk";
const TARGET_AREA = "slsp";

// Slugify function matching Desk's parser.ts
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);
}

// Extract project name from wiki link like "[[Project-Name]]"
function extractProjectFromWikiLink(link: string): string | null {
  const match = link.match(/\[\[([^\]]+)\]\]/);
  return match ? match[1] : null;
}

// Normalize date to YYYY-MM-DD string
function normalizeDate(date: any): string {
  if (!date) return new Date().toISOString().split("T")[0];
  if (date instanceof Date) return date.toISOString().split("T")[0];
  if (typeof date === "string") {
    // If already YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    // Try to parse and convert
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  }
  return new Date().toISOString().split("T")[0];
}

// Read all project files from Obsidian
function readObsidianProjects(): Map<string, { name: string; slug: string; status: string; created: string; content: string }> {
  const projectsDir = path.join(OBSIDIAN_PATH, "Projects");
  const projects = new Map();

  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith(".md"));

  for (const file of files) {
    const filePath = path.join(projectsDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);

    const name = data.title || file.replace(".md", "");
    const slug = slugify(name);

    // Also store by filename without extension for wiki link matching
    const filenameKey = file.replace(".md", "");

    const projectData = {
      name,
      slug,
      status: data.status || "active",
      created: normalizeDate(data.created),
      content: content.trim(),
    };

    projects.set(filenameKey, projectData);
    // Also map by slug for alternative matching
    projects.set(slug, projectData);
  }

  console.log(`Found ${files.length} projects in Obsidian`);
  return projects;
}

// Read all task files from Obsidian
function readObsidianTasks(): Array<{
  filename: string;
  title: string;
  status: string;
  priority: string | undefined;
  created: string;
  projectLink: string | null;
  content: string;
}> {
  const tasksDir = path.join(OBSIDIAN_PATH, "Tasks");
  const tasks: Array<any> = [];

  const files = fs.readdirSync(tasksDir).filter(f => f.endsWith(".md"));

  for (const file of files) {
    const filePath = path.join(tasksDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);

    tasks.push({
      filename: file,
      title: data.task_name || file.replace(".md", ""),
      status: mapStatus(data.status),
      priority: data.priority,
      created: normalizeDate(data.created || file.substring(0, 10)), // Extract date from filename like "2024-06-10-..."
      projectLink: data.project ? extractProjectFromWikiLink(data.project) : null,
      content: content.trim(),
    });
  }

  console.log(`Found ${tasks.length} tasks in Obsidian`);
  return tasks;
}

// Map Obsidian status to Desk status (they should be the same, but normalize)
function mapStatus(status: string | undefined): "todo" | "doing" | "waiting" | "done" {
  if (!status) return "todo";
  const s = status.toLowerCase();
  if (s === "done" || s === "completed") return "done";
  if (s === "doing" || s === "in progress" || s === "in_progress") return "doing";
  if (s === "waiting") return "waiting";
  return "todo";
}

// Create project directory and project.md in Desk
function createDeskProject(
  areaPath: string,
  project: { name: string; slug: string; status: string; created: string; content: string }
): string {
  const projectDir = path.join(areaPath, "projects", project.slug);
  const tasksDir = path.join(projectDir, "tasks");

  // Create directories
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(tasksDir, { recursive: true });

  // Create project.md with Desk format
  const projectContent = createFrontmatter({
    name: project.name,
    status: project.status,
    created: project.created,
  }) + "\n\n" + project.content;

  fs.writeFileSync(path.join(projectDir, "project.md"), projectContent);

  return projectDir;
}

// Manually create frontmatter string (avoid gray-matter.stringify issues with special content)
function createFrontmatter(data: Record<string, any>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      // Quote strings that might have special characters
      if (typeof value === "string" && (value.includes(":") || value.includes("#") || value.includes("'"))) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
  }
  lines.push("---");
  return lines.join("\n");
}

// Create task file in Desk
function createDeskTask(
  projectDir: string,
  task: {
    filename: string;
    title: string;
    status: string;
    priority: string | undefined;
    created: string;
    content: string;
  }
): void {
  const tasksDir = path.join(projectDir, "tasks");

  // Generate filename: use original if it has date prefix, otherwise generate
  let filename = task.filename;
  if (!filename.match(/^\d{4}-\d{2}-\d{2}/)) {
    const dateStr = task.created || new Date().toISOString().split("T")[0];
    const slug = slugify(task.title);
    filename = `${dateStr}-${slug}.md`;
  }

  // Build frontmatter
  const frontmatter: Record<string, any> = {
    title: task.title,
    status: task.status,
    created: task.created,
  };

  if (task.priority) {
    frontmatter.priority = task.priority;
  }

  const taskContent = createFrontmatter(frontmatter) + "\n\n" + task.content;
  fs.writeFileSync(path.join(tasksDir, filename), taskContent);
}

// Main migration function
function migrate() {
  console.log("=== Obsidian → Desk Migration ===\n");

  // Read source data
  const projects = readObsidianProjects();
  const tasks = readObsidianTasks();

  // Target area path
  const areaPath = path.join(DESK_PATH, "areas", TARGET_AREA);

  // Ensure area exists
  if (!fs.existsSync(areaPath)) {
    console.error(`Area ${TARGET_AREA} does not exist at ${areaPath}`);
    process.exit(1);
  }

  // Track created projects and their directories
  const projectDirs = new Map<string, string>();

  // Create all projects first
  console.log("\n--- Creating Projects ---");
  for (const [key, project] of projects) {
    // Skip duplicate entries (we stored by both filename and slug)
    if (projectDirs.has(project.slug)) continue;

    const projectDir = createDeskProject(areaPath, project);
    projectDirs.set(project.slug, projectDir);
    // Also map by original filename for task matching
    projectDirs.set(key, projectDir);
    console.log(`  ✓ ${project.name} → ${project.slug}/`);
  }

  // Create "_unassigned" project for tasks without a project
  const unassignedDir = path.join(areaPath, "projects", "_unassigned");
  fs.mkdirSync(path.join(unassignedDir, "tasks"), { recursive: true });
  fs.writeFileSync(
    path.join(unassignedDir, "project.md"),
    createFrontmatter({
      name: "Unassigned",
      status: "active",
      created: new Date().toISOString().split("T")[0],
    }) + "\n\nTasks without a project assignment"
  );
  console.log(`  ✓ Unassigned → _unassigned/`);

  // Assign tasks to projects
  console.log("\n--- Creating Tasks ---");
  let assigned = 0;
  let unassignedCount = 0;

  for (const task of tasks) {
    let targetDir: string | undefined;

    if (task.projectLink) {
      // Try to find project by wiki link name
      const projectSlug = slugify(task.projectLink);
      targetDir = projectDirs.get(task.projectLink) || projectDirs.get(projectSlug);
    }

    if (!targetDir) {
      targetDir = unassignedDir;
      unassignedCount++;
    } else {
      assigned++;
    }

    createDeskTask(targetDir, task);
  }

  console.log(`  ✓ ${assigned} tasks assigned to projects`);
  console.log(`  ✓ ${unassignedCount} tasks in _unassigned`);

  console.log("\n=== Migration Complete ===");
  console.log(`Projects created: ${projectDirs.size / 2}`); // Divide by 2 because we store each project twice
  console.log(`Total tasks: ${tasks.length}`);
  console.log(`\nData migrated to: ${areaPath}/projects/`);
}

// Run migration
migrate();
