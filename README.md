<p align="center">
  <img src="icon.png" alt="desk.md" width="128" height="128">
</p>

# desk.md

> Project-centric work management for freelancers and consultants.

## What is desk.md?

desk.md is a desktop app that organizes your work around **workspaces** and **projects**. Built for freelancers and consultants who manage multiple clients and need a single place for tasks, docs, and meetings.

```
Workspace (Client or Personal)
├── Tasks           ← Aggregates project tasks + unassigned
├── Docs            ← Workspace-level docs
├── Meetings        ← Aggregates project meetings
├── _unassigned/    ← Items not yet assigned to a project
└── Projects
    └── Project X
        ├── Tasks
        ├── Docs
        └── Meetings
```

**Key ideas:**
- **Work Mode** navigation with explicit workspace switching
- **Workspaces** separate your clients/contexts completely (Personal is also a workspace)
- **Projects** contain everything related to that work
- **Unassigned** items can exist without a project for quick capture
- **Markdown files** underneath - portable, grep-able, yours forever
- **AI-ready** - attach docs as context for smart assistance

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
- **Work Mode** navigation with workspace selector at sidebar bottom
- **Personal workspace** - first option in selector, with capture inbox
- Workspaces with color coding (dot in selector and page headers)
- Projects listed directly in sidebar (alphabetically sorted)
- Tasks: Kanban board with drag-drop, quick add, detail panel
- Docs: Tree structure with folders, drag-drop import, scope selector
- Meetings: Aggregated view across workspace projects
- Unassigned items: Tasks/docs/meetings not linked to any project
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
│   ├── _personal/              # Personal workspace (first in selector)
│   │   ├── workspace.md
│   │   ├── docs/
│   │   ├── _capture/tasks/     # Quick capture for triage
│   │   ├── _unassigned/
│   │   │   ├── tasks/
│   │   │   └── docs/
│   │   └── projects/
│   ├── client-a/
│   │   ├── workspace.md
│   │   ├── docs/               # Workspace-level docs (contracts, etc.)
│   │   ├── _unassigned/
│   │   │   ├── tasks/
│   │   │   ├── docs/
│   │   │   └── meetings/
│   │   └── projects/
│   │       ├── project-1/
│   │       │   ├── project.md
│   │       │   ├── tasks/
│   │       │   ├── docs/
│   │       │   └── meetings/
│   │       └── project-2/
│   └── client-b/
└── config.json
```

## License

Private project.
