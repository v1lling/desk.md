# Orbit - Project-Centric Work Management

> Desktop app for freelancers to manage projects, tasks, and notes across multiple clients.

## Core Concept

**Everything lives under projects, projects live under areas.**

```
Area (Client/Workspace)
  └── Project
        ├── Tasks
        ├── Notes
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
│       └── projects/
│           └── {project}/
│               ├── project.md
│               ├── tasks/*.md
│               └── notes/*.md
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

## Current State: v0.1

Working features:
- Areas with color coding
- Projects with status tracking
- Tasks: Kanban board (4 columns), drag-drop, detail panel, quick add
- Notes: WYSIWYG markdown editor (Tiptap)
- Settings: Theme toggle
- File system: All data in portable markdown

## What's Next

- **Inbox**: Quick capture tasks without assigning to a project, sort later (`areas/{area}/_inbox/tasks/`)
- Global search / Cmd+K
- Keyboard shortcuts
- AI context integration
- Email integration

## Dev Notes

- Routes use query params (`/projects/view?id=xxx`) due to static export
- Mock data in `lib/orbit/*.ts` - only used when `isTauri() === false`
- Tiptap editor stores markdown internally, converts to/from HTML for editing
