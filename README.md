<p align="center">
  <img src="icon.png" alt="desk.md" width="128" height="128">
</p>

# desk.md

> Project-centric work management for freelancers and consultants.

## What is desk.md?

desk.md is a desktop app that organizes your work around **projects**, not notes. Built for people who manage multiple clients and need a single place for tasks, notes, and project context.

```
Workspace (Client)
  └── Project
        ├── Tasks (kanban board)
        ├── Notes (meeting logs, decisions)
        ├── Meetings
        └── Context (AI knowledge base - future)
```

**Key ideas:**
- **Workspaces** separate your clients/contexts completely
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

## Current Status: v0.4

Working features:
- Workspaces with color coding and switching
- Projects with status tracking (active/paused/completed/archived)
- Tasks: Kanban board with drag-drop, quick add, detail panel
- Docs: Tree structure with folders, drag-drop import
- Meetings: List view with editor
- Unassigned items: Tasks/docs not linked to any project
- Project reassignment: Move tasks/docs between projects
- Settings: Theme toggle, data path configuration
- Setup wizard with existing data detection
- File system: All data in portable markdown
- AI Chat: Claude Code CLI or Anthropic API, with doc context
- Email integration: Deep links from Outlook add-in

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Project overview & AI context
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System design
- [docs/FEATURES.md](./docs/FEATURES.md) - Feature specs

## Data Storage

Desk stores everything in `~/Desk/` as markdown files:

```
~/Desk/
├── workspaces/
│   ├── client-a/
│   │   ├── workspace.md
│   │   └── projects/
│   │       ├── _unassigned/      # Items not in a project
│   │       │   ├── tasks/
│   │       │   └── docs/
│   │       ├── project-1/
│   │       │   ├── project.md
│   │       │   ├── tasks/
│   │       │   ├── docs/
│   │       │   └── meetings/
│   │       └── project-2/
│   └── client-b/
├── personal/
│   ├── capture/tasks/
│   ├── tasks/
│   └── docs/
└── config.json
```

## License

Private project.
