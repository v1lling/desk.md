# Orbit - Project-Centric Work Management

> Desktop app for freelancers to manage projects, tasks, and notes across multiple clients.

## Core Concept

**Everything lives under projects, projects live under areas.**

```
Area (Client/Workspace)
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
├── areas/
│   └── {area}/
│       ├── area.md
│       ├── .view.json              # Area-level UI state (All Tasks ordering)
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

## Current State: v0.2

Working features:
- Areas with color coding
- Projects with status tracking
- Tasks: Kanban board (4 columns), drag-drop, detail panel, quick add
- Notes: WYSIWYG markdown editor (Tiptap)
- Meetings: List view with editor
- Unassigned items: Tasks/notes can exist without a project
- Project reassignment: Move tasks/notes between projects
- Settings: Theme toggle, data path configuration
- File system: All data in portable markdown

## What's Next

- Global search / Cmd+K
- Keyboard shortcuts
- AI context integration
- Email integration

## Architecture

Key modules in `src/lib/orbit/`:
- `constants.ts` - Magic strings (SPECIAL_DIRS, PATH_SEGMENTS)
- `search.ts` - Cross-area search helpers
- `calculations.ts` - Business logic (task stats)
- `parser.ts` - Markdown/frontmatter parsing
- `tauri-fs.ts` - File system abstraction (Tauri/mock)

Design tokens in `src/lib/design-tokens.ts` for consistent styling.

## Data Storage Patterns

**Content vs Display Data Separation:**

| Type | Format | Location | Purpose |
|------|--------|----------|---------|
| Content data | Markdown + YAML frontmatter | `*.md` files | Tasks, notes, projects - the actual work |
| Global config | JSON | `~/Orbit/config.json` | App-wide settings (theme, current area) |
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

- Routes use query params (`/projects/view?id=xxx`) due to static export
- Mock data in `lib/orbit/*.ts` - only used when `isTauri() === false`
- Tiptap editor stores markdown internally, converts to/from HTML for editing
- `_unassigned` is a special directory for items not belonging to a project
