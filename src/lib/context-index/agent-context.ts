import { getDeskPath, joinPath, writeTextFile } from "@/lib/desk/tauri-fs";
import { getWorkspacePath } from "@/lib/desk/paths";
import { FILE_NAMES } from "@/lib/desk/constants";
import { isTauri } from "@/lib/desk/tauri-fs";
import type { Workspace, Project } from "@/types";

// =============================================================================
// TOP-LEVEL CONTEXT (~/Desk/CLAUDE.md + ~/Desk/AGENTS.md)
// =============================================================================

function buildTopLevelContext(workspaces: Workspace[]): string {
  const lines: string[] = [];

  lines.push("# Desk — AI Agent Context");
  lines.push("");
  lines.push(
    "Desk is a markdown-based work management system. All data lives as `.md` files with YAML frontmatter on the local filesystem — clients, projects, tasks, docs, meetings. You're meant to read across it; that's why it's structured this way."
  );
  lines.push("");

  // How this space works (norms, non-imperative)
  lines.push("## How this space works");
  lines.push("");
  lines.push("A few conventions keep this knowledge base coherent and tidy.");
  lines.push("");
  lines.push(
    "**`docs/`** holds notes the user curates — contracts, references, drafts heading to clients. Read it freely when you need context. Don't write to it directly; new material flows in via `ai-docs/draft-*.md` and the user promotes it to `docs/` when ready."
  );
  lines.push("");
  lines.push(
    "**`ai-docs/`** is the AI working area. Everything here is AI-written — distilled from conversations, research, or analysis. This is where you capture and organize what you learn."
  );
  lines.push("");
  lines.push(
    "**`tasks/`** and **`meetings/`** are real, committed work items. Treat new ones as something the user decides to add — when you spot a candidate, surface it in chat rather than writing the file yourself."
  );
  lines.push("");
  lines.push(
    "**`.aiignore`** at each workspace root lists files the user has flagged as sensitive (gitignore-style patterns). Honor it. The in-app assistant enforces these exclusions automatically; external agents are asked to do the same."
  );
  lines.push("");

  // Conventions inside ai-docs
  lines.push("## Conventions inside ai-docs");
  lines.push("");
  lines.push("A small vocabulary keeps `ai-docs/` findable as it grows:");
  lines.push("");
  lines.push("- `context.md` — running project brief, kept current as understanding grows");
  lines.push("- `research-{topic}.md` — investigations with sources");
  lines.push("- `notes-{topic}.md` — working notes, append-friendly");
  lines.push("- `draft-{topic}.md` — material destined for `docs/` after review");
  lines.push("- `adr-NNN-{topic}.md` — recorded decisions");
  lines.push("");
  lines.push("Append to an existing note when continuing a thread. New files are for new topics, not new thoughts.");
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
  lines.push(
    "Each workspace has its own `CLAUDE.md` with project listings and a `WORKSPACE_CONTEXT.md` with an AI-generated catalog of all docs, tasks, and meetings."
  );
  lines.push("");

  // Directory structure (collapsed)
  lines.push("## Directory Structure");
  lines.push("");
  lines.push("```");
  lines.push("~/Desk/");
  lines.push("├── CLAUDE.md / AGENTS.md            # This file");
  lines.push("└── workspaces/");
  lines.push("    └── {workspaceId}/               # _personal or a client workspace");
  lines.push("        ├── workspace.md             # metadata");
  lines.push("        ├── CLAUDE.md                # workspace anchor");
  lines.push("        ├── WORKSPACE_CONTEXT.md     # AI-generated file catalog");
  lines.push("        ├── .aiignore                # sensitive paths to skip");
  lines.push("        ├── docs/                    # human-curated");
  lines.push("        ├── ai-docs/                 # AI working area");
  lines.push("        ├── _unassigned/             # items without a project (tasks/docs/meetings)");
  lines.push("        ├── _capture/                # Personal workspace only — triage inbox (tasks)");
  lines.push("        └── projects/{projectId}/");
  lines.push("            ├── project.md");
  lines.push("            ├── docs/                # human-curated");
  lines.push("            ├── ai-docs/             # AI working area");
  lines.push("            ├── tasks/");
  lines.push("            └── meetings/");
  lines.push("```");
  lines.push("");

  // File naming
  lines.push("## File Naming Convention");
  lines.push("");
  lines.push("Tasks, docs, and meetings follow: `YYYY-MM-DD-{slug}.md`");
  lines.push("");
  lines.push("- Date prefix: creation date in ISO format");
  lines.push("- Slug: lowercase, hyphenated title (max 50 chars)");
  lines.push("- The file ID is the filename without `.md`");
  lines.push("");

  // Frontmatter schemas
  lines.push("## Frontmatter Schemas");
  lines.push("");
  lines.push("All files use YAML frontmatter; the markdown body follows `---`.");
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
  lines.push("```");
  lines.push("");

  lines.push("### Doc (`docs/*.md` and `ai-docs/*.md`)");
  lines.push("```yaml");
  lines.push("---");
  lines.push("title: Architecture Overview");
  lines.push("created: \"2024-06-15\"");
  lines.push("---");
  lines.push("```");
  lines.push("");

  lines.push("### Meeting (`meetings/*.md`)");
  lines.push("```yaml");
  lines.push("---");
  lines.push("title: Weekly Sync");
  lines.push("date: \"2024-06-15\"     # when meeting occurred (required)");
  lines.push("created: \"2024-06-15\"  # when note was written (required)");
  lines.push("attendees:             # optional");
  lines.push("  - Alice");
  lines.push("  - Bob");
  lines.push("---");
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
  lines.push("color: \"#3b82f6\"       # optional");
  lines.push("created: \"2024-01-01\"");
  lines.push("---");
  lines.push("```");
  lines.push("");

  // Creating & editing
  lines.push("## Creating & Editing Items");
  lines.push("");
  lines.push(
    "To create a new task, doc, or meeting, write a `.md` file with the correct frontmatter in the appropriate directory. To edit: modify the frontmatter or body. To delete: remove the file."
  );
  lines.push("");
  lines.push(
    "To create a new project: add a directory under `projects/` with a `project.md`, plus `tasks/`, `docs/`, `ai-docs/`, and `meetings/` subdirectories."
  );
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

  lines.push("## Projects");
  lines.push("");
  if (projects.length === 0) {
    lines.push("No projects yet. Items live in `_unassigned/`.");
  } else {
    lines.push("| Name | ID | Status |");
    lines.push("|------|----|--------|");
    for (const proj of projects) {
      lines.push(`| ${proj.name} | ${proj.id} | ${proj.status} |`);
    }
  }
  lines.push("");

  lines.push(
    `See \`${FILE_NAMES.WORKSPACE_CONTEXT_MD}\` for an AI-generated catalog of all files with summaries. The global \`~/Desk/CLAUDE.md\` covers conventions and how this space works.`
  );
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
