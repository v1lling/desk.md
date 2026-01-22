# Orbit - Project-Centric Work Management

> Desktop app for freelancers to manage projects, tasks, and docs across multiple clients.

## Quick Start

```bash
npm run dev        # Browser with mock data (port 3001)
npm run tauri dev  # Desktop with real file system
```

## Core Concept

```
Personal Space (private, no workspace)
├── Inbox, Tasks, Docs

Workspace (Client/Context)
├── Workspace-level Docs
└── Projects
    └── Project
        ├── Tasks, Docs, Meetings
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed structure, file paths, and design decisions.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Desktop**: Tauri 2 (Rust shell)
- **State**: TanStack Query (server), Zustand (client)
- **Editor**: Tiptap (WYSIWYG markdown)
- **Drag & Drop**: @dnd-kit

## Data Models

```typescript
type TaskStatus = 'todo' | 'doing' | 'waiting' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';
type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';
type DocScope = 'personal' | 'workspace' | 'project';
```

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/lib/orbit/` | Core CRUD operations |
| `src/stores/` | TanStack Query hooks |
| `src/components/` | React components by feature |
| `src/app/` | Next.js routes |

## Current State: v0.4

See [docs/FEATURES.md](docs/FEATURES.md) for full feature list.

Key features:
- Dashboard with Focus and Workspaces widgets
- Personal Space (inbox, tasks, docs)
- Workspaces with color coding
- Projects inline in sidebar (alphabetically sorted)
- Project detail with Tasks, Docs, Meetings tabs
- **Docs**: Tree structure with folders, drag-drop import
- Global search (Cmd+K)
- Auto-save with file watcher

## Dev Notes

- Dashboard at `/`, All Tasks at `/tasks`
- No dedicated `/projects` page - projects listed inline in sidebar
- Project detail at `/projects/view?id=xxx` (query params due to static export)
- Mock data used when `isTauri() === false`
- `_unassigned` is a special directory for items without a project
- **Single user**: No migration code or backward compatibility needed
- All path strings must use `PATH_SEGMENTS.*` from `constants.ts`
