# Orbit

> Project-centric work management for freelancers and consultants.

## What is Orbit?

Orbit is a desktop app that organizes your work around **projects**, not notes. Built for people who manage multiple clients and need a single place for tasks, notes, and project context.

```
Area (Client)
  └── Project
        ├── Tasks (kanban board)
        ├── Notes (meeting logs, decisions)
        └── Context (AI knowledge base)
```

**Key ideas:**
- **Areas** separate your clients/workspaces completely
- **Projects** contain everything related to that work
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
npm run dev           # Web development
npm run tauri dev     # Desktop development
```

## Current Status

All core phases complete:
- ✅ Foundation (app shell, areas, settings, setup wizard)
- ✅ Tasks & Kanban (drag-drop board, task CRUD)
- ✅ Projects (list, project hub with tabs)
- ✅ Notes (list, editor with markdown preview)
- ✅ Settings & Polish (theme toggle, toast notifications)

**Currently using mock data** - file system integration is next.

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Project overview & AI context
- [docs/PROGRESS.md](./docs/PROGRESS.md) - Detailed implementation progress
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System design
- [docs/FEATURES.md](./docs/FEATURES.md) - Feature specs
- [docs/PHASES.md](./docs/PHASES.md) - Implementation roadmap
- [docs/DATA-MODELS.md](./docs/DATA-MODELS.md) - Data structures
- [docs/QUICKSTART.md](./docs/QUICKSTART.md) - Setup guide

## Data Storage

Orbit stores everything in `~/Orbit/` as markdown files:

```
~/Orbit/
├── areas/
│   ├── client-a/
│   │   ├── area.md
│   │   └── projects/
│   │       ├── project-1/
│   │       │   ├── project.md
│   │       │   ├── tasks/
│   │       │   ├── notes/
│   │       │   └── context/
│   │       └── project-2/
│   └── client-b/
└── config.json
```

## License

Private project.
