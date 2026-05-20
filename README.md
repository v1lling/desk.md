<p align="center">
  <img src="icon.png" alt="desk.md" width="128" height="128">
</p>

# desk.md

> A local-first home for your projects, tasks, docs, and meetings — all plain Markdown files you own.

## What is desk.md?

desk.md is a desktop app for running your work — projects, tasks, documents, and
meetings — stored as plain Markdown files on your own machine. If you like the
idea of Obsidian's local Markdown vault but want something built around
**projects and task tracking** rather than note-graphs, that's desk.md.

- **You own your data.** Everything is plain Markdown with YAML frontmatter in a
  normal folder. No database, no lock-in — open it in any editor, including Obsidian.
- **Local-first.** Works fully offline. No account, no mandatory cloud.
- **Organized by workspace.** Group work into workspaces — one per client, side
  project, or area of life — each with its own projects, tasks, docs, and meetings.
- **Structured task tracking.** Statuses, priorities, due dates, Kanban/list
  views, and a quick-capture inbox for triage.
- **Optional AI assistant.** A built-in assistant can search and read your
  workspace to answer questions and draft text — entirely optional.

## Who is it for?

Anyone who wants to run their work from local Markdown files: indie developers,
writers, students, makers — and freelancers juggling multiple clients, where
workspaces map naturally onto clients.

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Desktop: Tauri 2
- UI: shadcn/ui
- State: Zustand + TanStack Query
- Storage: Local Markdown files under `~/Desk/`

## Quick Start

```bash
npm install
npm run dev          # Browser with mock data
npm run tauri dev    # Desktop with the real file system
```

## Documentation

- [docs/FEATURES.md](./docs/FEATURES.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/EMAIL-INTEGRATION.md](./docs/EMAIL-INTEGRATION.md)

## Data Storage

Desk stores user content in `~/Desk/workspaces/*` and app metadata in `~/Desk/.desk/`.
One workspace is the **home workspace** (`home: true` in its `workspace.md`) — it
holds the quick-capture inbox and is created when you first set up Desk.

## License

[GPL-3.0-or-later](./LICENSE). You're free to use, modify, and share desk.md.
Because the GPL is copyleft, any distributed fork or derivative must also remain
open-source under the GPL.
