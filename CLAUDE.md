# Orbit - Project-Centric Work Management

> Desktop app for freelancers to manage projects, tasks, and notes across multiple clients.

## Core Concept

**Everything lives under projects, projects live under workspaces.**

```
Workspace (Client/Context)
  └── Project
        ├── Tasks
        ├── Notes
        ├── Meetings
        └── Context (AI knowledge - future)
```

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Desktop**: Tauri 2 (Rust shell)
- **State**: TanStack Query (server), Zustand (client)
- **Editor**: Tiptap (WYSIWYG markdown)
- **Drag & Drop**: @dnd-kit

## File Structure

```
~/Orbit/
├── personal/                       # Personal space (not workspace-scoped)
│   ├── inbox/tasks/*.md            # Quick capture items
│   ├── tasks/*.md                  # Personal tasks
│   └── notes/*.md                  # Personal notes
├── workspaces/
│   └── {workspace}/
│       ├── workspace.md
│       ├── .view.json              # Workspace-level UI state (All Tasks ordering)
│       └── projects/
│           ├── _unassigned/        # Tasks/notes not in a project
│           │   ├── tasks/*.md
│           │   ├── notes/*.md
│           │   └── .view.json      # UI state (task order, etc.)
│           └── {project}/
│               ├── project.md
│               ├── tasks/*.md
│               ├── notes/*.md
│               ├── meetings/*.md
│               └── .view.json      # UI state (task order, etc.)
└── config.json
```

## Data Models

```typescript
type TaskStatus = 'todo' | 'doing' | 'waiting' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';
type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';
```

## Development

```bash
npm run dev        # Browser with mock data
npm run tauri dev  # Desktop with file system
```

## Current State: v0.3

Working features:
- **Dashboard**: Cross-workspace overview with Capture, Focus, and Workspaces widgets
- **Capture widget**: Quick task capture with triage flow (move to Personal or Workspace/Project)
- Workspaces with color coding, inline in sidebar
- Projects with status tracking
- Tasks: Kanban board (4 columns), drag-drop, detail panel, quick add
- Notes: WYSIWYG markdown editor (Tiptap)
- Meetings: List view with editor
- Unassigned items: Tasks/notes can exist without a project
- Project reassignment: Move tasks/notes between projects
- **Personal Space**: Inbox, tasks, and notes not tied to any workspace
- **Collapsible sidebar sections**: Personal and workspace nav collapse independently
- Settings: Theme toggle, data path configuration
- File system: All data in portable markdown
- **File watcher**: Auto-refresh UI when files change externally
- **Search index**: In-memory Fuse.js index for fast search
- **Global search (Cmd+K)**: Find tasks, notes, meetings instantly
- **Auto-save**: Obsidian-like silent persistence (error-only indicator)

## What's Next

- Keyboard shortcuts
- AI context integration
- Email integration

## Architecture

Key modules in `src/lib/orbit/`:
- `constants.ts` - Magic strings (SPECIAL_DIRS, PATH_SEGMENTS, PERSONAL_SPACE_ID)
- `dashboard.ts` - Cross-workspace data aggregation for dashboard
- `personal.ts` - Personal space CRUD (inbox, tasks, notes)
- `search.ts` - Cross-workspace search helpers
- `search-index.ts` - In-memory Fuse.js search index
- `watcher.ts` - File system watcher service (Tauri)
- `calculations.ts` - Business logic (task stats)
- `parser.ts` - Markdown/frontmatter parsing
- `tauri-fs.ts` - File system abstraction (Tauri/mock)

Key hooks in `src/hooks/`:
- `use-auto-save.ts` - Debounced auto-save with error-only status
- `use-file-watcher.ts` - React hook for file watcher integration
- `use-search-index.ts` - React hook for search index management

Design tokens in `src/lib/design-tokens.ts` for consistent styling.

## Data Storage Patterns

**Content vs Display Data Separation:**

| Type | Format | Location | Purpose |
|------|--------|----------|---------|
| Content data | Markdown + YAML frontmatter | `*.md` files | Tasks, notes, projects - the actual work |
| Global config | JSON | `~/Orbit/config.json` | App-wide settings (theme, current workspace) |
| View state | JSON | `.view.json` per project | UI preferences (task order, collapsed state) |

**Key principle:** Content data belongs in markdown (portable, grep-able). UI/display preferences belong in `.view.json` files (not part of the content, can be regenerated).

Example `.view.json`:
```json
{
  "taskOrder": {
    "todo": ["task-id-1", "task-id-2"],
    "doing": ["task-id-3"]
  }
}
```

If `.view.json` is missing or corrupted, the app falls back to default ordering (by created date). No data loss.

## Dev Notes

- Dashboard at `/`, All Tasks at `/tasks`
- Routes use query params (`/projects/view?id=xxx`) due to static export
- Mock data in `lib/orbit/*.ts` - only used when `isTauri() === false`
- Tiptap editor stores markdown internally, converts to/from HTML for editing
- `_unassigned` is a special directory for items not belonging to a project
- **Single user**: This app has no other users besides the developer. No need for migration code or backward compatibility.
