# Orbit

> Project-centric work management for freelancers and consultants.

## What is Orbit?

Orbit is a desktop app that organizes your work around **projects**, not notes. Built for people who manage multiple clients and need a single place for tasks, notes, and project context.

```
Area (Client)
  └── Project
        ├── Tasks (kanban board)
        ├── Notes (meeting logs, decisions)
        ├── Meetings
        └── Context (AI knowledge base - future)
```

**Key ideas:**
- **Areas** separate your clients/workspaces completely
- **Projects** contain everything related to that work
- **Unassigned** items can exist without a project for quick capture
- **Markdown files** underneath - portable, grep-able, yours forever
- **AI-ready** - each project has context that powers smart assistance

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Desktop**: Tauri 2.9 (Rust shell, ~15MB binary)
- **UI**: shadcn/ui
- **State**: Zustand + TanStack Query
- **Drag & Drop**: @dnd-kit
- **Notifications**: Sonner
- **Storage**: Local markdown files

## Quick Start

```bash
npm install
npm run dev           # Web development (mock data)
npm run tauri dev     # Desktop development (real file system)
```

## Current Status: v0.2

Working features:
- Areas with color coding and switching
- Projects with status tracking (active/paused/completed/archived)
- Tasks: Kanban board with drag-drop, quick add, detail panel
- Notes: WYSIWYG markdown editor (Tiptap)
- Meetings: List view with editor
- Unassigned items: Tasks/notes not linked to any project
- Project reassignment: Move tasks/notes between projects
- Settings: Theme toggle, data path configuration
- Setup wizard with existing data detection
- File system: All data in portable markdown

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Project overview & AI context
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System design
- [docs/FEATURES.md](./docs/FEATURES.md) - Feature specs

## Data Storage

Orbit stores everything in `~/Orbit/` as markdown files:

```
~/Orbit/
├── areas/
│   ├── client-a/
│   │   ├── area.md
│   │   └── projects/
│   │       ├── _unassigned/      # Items not in a project
│   │       │   ├── tasks/
│   │       │   └── notes/
│   │       ├── project-1/
│   │       │   ├── project.md
│   │       │   ├── tasks/
│   │       │   ├── notes/
│   │       │   └── meetings/
│   │       └── project-2/
│   └── client-b/
└── config.json
```

## License

Private project.
