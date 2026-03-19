import { getDeskPath, joinPath, writeTextFile } from "@/lib/desk/tauri-fs";
import { getWorkspacePath } from "@/lib/desk/paths";
import { FILE_NAMES, SPECIAL_DIRS } from "@/lib/desk/constants";
import { isTauri } from "@/lib/desk/tauri-fs";
import type { Workspace, Project } from "@/types";

// =============================================================================
// TOP-LEVEL CONTEXT (~/Desk/CLAUDE.md + ~/Desk/AGENTS.md)
// =============================================================================

function buildTopLevelContext(workspaces: Workspace[]): string {
  const lines: string[] = [];

  lines.push("# Desk — AI Agent Context");
  lines.push("");
  lines.push("Desk is a markdown-based work management system for freelancers.");
  lines.push("All data lives as `.md` files with YAML frontmatter on the local filesystem.");
  lines.push("You can read, create, edit, and delete items by working with these files directly.");
  lines.push("");

  // Workspaces table
  lines.push("## Workspaces");
  lines.push("");
  if (workspaces.length === 0) {
    lines.push("No workspaces yet.");
  } else {
    lines.push("| Name | ID | Description | Path |");
    lines.push("|------|----|-------------|------|");
    for (const ws of workspaces) {
      const desc = ws.description || "";
      const path = `workspaces/${ws.id}/`;
      lines.push(`| ${ws.name} | ${ws.id} | ${desc} | ${path} |`);
    }
  }
  lines.push("");
  lines.push("Each workspace has its own `CLAUDE.md` with project listings and a `WORKSPACE_CONTEXT.md` with an AI-generated file catalog (summaries of all docs, tasks, and meetings).");
  lines.push("");

  // Directory structure
  lines.push("## Directory Structure");
  lines.push("");
  lines.push("```");
  lines.push("~/Desk/");
  lines.push("├── CLAUDE.md                        # This file");
  lines.push("├── AGENTS.md                        # Same content (for non-Claude agents)");
  lines.push("└── workspaces/");
  lines.push("    ├── _personal/                   # Personal workspace (always exists)");
  lines.push("    │   ├── workspace.md              # Workspace metadata");
  lines.push("    │   ├── CLAUDE.md                 # Workspace-level agent context");
  lines.push("    │   ├── WORKSPACE_CONTEXT.md      # AI-generated file catalog");
  lines.push("    │   ├── .aiignore                 # Files to exclude from AI indexing");
  lines.push("    │   ├── docs/                     # Workspace-level docs (tree with folders)");
  lines.push("    │   ├── _capture/                 # Quick triage inbox (Personal only)");
  lines.push("    │   │   └── tasks/");
  lines.push("    │   ├── _unassigned/              # Items without a project");
  lines.push("    │   │   ├── tasks/");
  lines.push("    │   │   └── docs/");
  lines.push("    │   └── projects/");
  lines.push("    │       └── {projectId}/");
  lines.push("    │           ├── project.md        # Project metadata");
  lines.push("    │           ├── tasks/            # Task markdown files");
  lines.push("    │           ├── docs/             # Doc tree (folders allowed)");
  lines.push("    │           └── meetings/         # Meeting note files");
  lines.push("    └── {workspaceId}/                # Client workspaces");
  lines.push("        ├── workspace.md");
  lines.push("        ├── CLAUDE.md");
  lines.push("        ├── WORKSPACE_CONTEXT.md");
  lines.push("        ├── docs/                     # Workspace-level docs");
  lines.push("        ├── _unassigned/");
  lines.push("        │   ├── tasks/");
  lines.push("        │   ├── docs/");
  lines.push("        │   └── meetings/");
  lines.push("        └── projects/{projectId}/");
  lines.push("            ├── project.md");
  lines.push("            ├── tasks/");
  lines.push("            ├── docs/");
  lines.push("            └── meetings/");
  lines.push("```");
  lines.push("");

  // File naming
  lines.push("## File Naming Convention");
  lines.push("");
  lines.push("All content files (tasks, docs, meetings) follow: `YYYY-MM-DD-{slug}.md`");
  lines.push("");
  lines.push("- Date prefix: creation date in ISO format");
  lines.push("- Slug: lowercase, hyphenated title (max 50 chars)");
  lines.push("- Example: `2024-06-15-setup-webhook-integration.md`");
  lines.push("- The file ID is the filename without `.md`");
  lines.push("");

  // Frontmatter schemas
  lines.push("## Frontmatter Schemas");
  lines.push("");
  lines.push("All files use YAML frontmatter. The markdown body follows after `---`.");
  lines.push("");

  lines.push("### Task (`tasks/*.md`)");
  lines.push("```yaml");
  lines.push("---");
  lines.push("title: Setup webhook integration");
  lines.push("status: doing          # backlog | todo | doing | waiting | done");
  lines.push("priority: high         # low | medium | high (optional)");
  lines.push("due: \"2024-06-20\"      # ISO date (optional)");
  lines.push("created: \"2024-06-15\"  # ISO date (required)");
  lines.push("---");
  lines.push("Task description and notes in markdown...");
  lines.push("```");
  lines.push("");

  lines.push("### Doc (`docs/*.md`)");
  lines.push("```yaml");
  lines.push("---");
  lines.push("title: Architecture Overview");
  lines.push("created: \"2024-06-15\"  # ISO date (required)");
  lines.push("---");
  lines.push("Document content in markdown...");
  lines.push("```");
  lines.push("");

  lines.push("### Meeting (`meetings/*.md`)");
  lines.push("```yaml");
  lines.push("---");
  lines.push("title: Weekly Sync");
  lines.push("date: \"2024-06-15\"     # When meeting occurred (required)");
  lines.push("created: \"2024-06-15\"  # When note was created (required)");
  lines.push("attendees:             # Optional list");
  lines.push("  - Alice");
  lines.push("  - Bob");
  lines.push("---");
  lines.push("Meeting notes and action items...");
  lines.push("```");
  lines.push("");

  lines.push("### Project (`project.md`)");
  lines.push("```yaml");
  lines.push("---");
  lines.push("name: Website Redesign");
  lines.push("status: active         # active | paused | completed | archived");
  lines.push("description: Complete redesign of the marketing site");
  lines.push("created: \"2024-01-01\"");
  lines.push("---");
  lines.push("```");
  lines.push("");

  lines.push("### Workspace (`workspace.md`)");
  lines.push("```yaml");
  lines.push("---");
  lines.push("name: Acme Corp");
  lines.push("description: Website and backend work");
  lines.push("color: \"#3b82f6\"       # Hex color for UI (optional)");
  lines.push("created: \"2024-01-01\"");
  lines.push("---");
  lines.push("```");
  lines.push("");

  // Special directories
  lines.push("## Special Directories");
  lines.push("");
  lines.push("- **`_personal`**: The Personal workspace. Always exists, always first in the UI. Has an extra `_capture/` inbox.");
  lines.push("- **`_unassigned`**: Items (tasks, docs, meetings) not assigned to any project. Every workspace has one.");
  lines.push("- **`_capture`**: Quick triage inbox within Personal workspace only. Contains tasks for later sorting.");
  lines.push("");

  // How to create items
  lines.push("## Creating & Editing Items");
  lines.push("");
  lines.push("To create a new task, doc, or meeting, write a `.md` file with the correct frontmatter in the appropriate directory.");
  lines.push("");
  lines.push("**Example: Create a task in project \"website\" of workspace \"acme\":**");
  lines.push("```bash");
  lines.push("# Write to: workspaces/acme/projects/website/tasks/2024-06-15-fix-login-bug.md");
  lines.push("```");
  lines.push("```yaml");
  lines.push("---");
  lines.push("title: Fix login bug");
  lines.push("status: todo");
  lines.push("priority: high");
  lines.push("created: \"2024-06-15\"");
  lines.push("---");
  lines.push("The login form throws a 500 error when...");
  lines.push("```");
  lines.push("");
  lines.push("To edit: modify the frontmatter or body content. To delete: remove the file.");
  lines.push("");
  lines.push("To create a new project: create a directory under `projects/` with a `project.md`, plus `tasks/`, `docs/`, and `meetings/` subdirectories.");
  lines.push("");

  // .aiignore
  lines.push("## .aiignore");
  lines.push("");
  lines.push("Each workspace can have a `.aiignore` file at its root with gitignore-style patterns to exclude files from the AI catalog.");
  lines.push("");

  return `${lines.join("\n").trim()}\n`;
}

// =============================================================================
// PER-WORKSPACE CONTEXT (workspaces/{id}/CLAUDE.md + AGENTS.md)
// =============================================================================

function buildPerWorkspaceContext(workspace: Workspace, projects: Project[]): string {
  const lines: string[] = [];

  lines.push(`# ${workspace.name}`);
  lines.push("");
  if (workspace.description) {
    lines.push(workspace.description);
    lines.push("");
  }
  lines.push(`- **Workspace ID**: ${workspace.id}`);
  lines.push(`- **Created**: ${workspace.created}`);
  lines.push("");

  // Projects table
  lines.push("## Projects");
  lines.push("");
  if (projects.length === 0) {
    lines.push("No projects yet. Items are in `_unassigned/`.");
  } else {
    lines.push("| Name | ID | Status |");
    lines.push("|------|----|--------|");
    for (const proj of projects) {
      lines.push(`| ${proj.name} | ${proj.id} | ${proj.status} |`);
    }
  }
  lines.push("");

  // Pointer to catalog
  lines.push("## File Catalog");
  lines.push("");
  lines.push(`See \`${FILE_NAMES.WORKSPACE_CONTEXT_MD}\` in this directory for an AI-generated catalog of all files with summaries.`);
  lines.push("");

  // Brief structure
  lines.push("## Structure");
  lines.push("");
  lines.push("```");
  lines.push(`${workspace.id}/`);
  if (workspace.id === SPECIAL_DIRS.PERSONAL) {
    lines.push("├── _capture/tasks/       # Quick triage inbox");
  }
  lines.push("├── _unassigned/          # Items without a project");
  lines.push("│   ├── tasks/");
  lines.push("│   ├── docs/");
  if (workspace.id !== SPECIAL_DIRS.PERSONAL) {
    lines.push("│   └── meetings/");
  } else {
    lines.push("│   └── docs/");
  }
  lines.push("├── docs/                 # Workspace-level docs");
  lines.push("└── projects/{id}/");
  lines.push("    ├── project.md");
  lines.push("    ├── tasks/");
  lines.push("    ├── docs/");
  lines.push("    └── meetings/");
  lines.push("```");
  lines.push("");

  return `${lines.join("\n").trim()}\n`;
}

// =============================================================================
// WRITE FUNCTIONS
// =============================================================================

export async function writeTopLevelAgentFiles(workspaces: Workspace[]): Promise<void> {
  if (!isTauri()) return;

  const deskPath = await getDeskPath();
  const content = buildTopLevelContext(workspaces);

  const claudePath = await joinPath(deskPath, FILE_NAMES.CLAUDE_MD);
  const agentsPath = await joinPath(deskPath, FILE_NAMES.AGENTS_MD);

  await writeTextFile(claudePath, content);
  await writeTextFile(agentsPath, content);
}

export async function writePerWorkspaceAgentFiles(
  workspaceId: string,
  workspace: Workspace,
  projects: Project[]
): Promise<void> {
  if (!isTauri()) return;

  const workspacePath = await getWorkspacePath(workspaceId);
  const content = buildPerWorkspaceContext(workspace, projects);

  const claudePath = await joinPath(workspacePath, FILE_NAMES.CLAUDE_MD);
  const agentsPath = await joinPath(workspacePath, FILE_NAMES.AGENTS_MD);

  await writeTextFile(claudePath, content);
  await writeTextFile(agentsPath, content);
}
