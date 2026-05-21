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
- **Agent-ready.** Organized so *you* can keep track of everything — and, in turn,
  so any AI agent picks up your full context instantly, without re-explaining it.

## Who is it for?

Anyone who wants to run their work from local Markdown files: indie developers,
writers, students, makers or freelancers juggling multiple clients, where
workspaces map naturally onto clients.

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Desktop: Tauri 2
- UI: shadcn/ui
- State: Zustand + TanStack Query
- Storage: Local Markdown files in a folder you choose (default `~/Desk/`)

## Quick Start

```bash
npm install
npm run dev          # Browser with mock data
npm run tauri dev    # Desktop with the real file system
```

## Data Storage

Desk stores user content under `workspaces/` and app metadata under `.desk/`,
inside the data folder you pick at setup (default `~/Desk/`). One workspace is the
**home workspace** (`home: true` in its `workspace.md`) — it holds the
quick-capture inbox and is created when you first set up Desk.

## AI

AI in Desk is **optional** — nothing is sent anywhere unless you choose to use
it. It comes in two forms.

### Bring your own agent

Desk keeps your data folder agent-ready. Alongside your Markdown it
auto-generates and maintains `CLAUDE.md` and `AGENTS.md` — describing how the
folder is organized, the frontmatter schemas, and where an agent may write (its
own `ai-docs/` area) versus your human-authored files, which it leaves alone. One
click of **Rebuild Catalog** adds `WORKSPACE_CONTEXT.md`, a summarized catalog of
every doc, task, and meeting.

Point Claude Code, Codex, or any CLI agent at your Desk folder and it immediately
understands your workspaces — ready to brainstorm, draft emails, or work through
projects with you. No MCP server, no plugins — just plain files and helper
Markdown.

### In-app assistant

Desk also has a built-in assistant for chat and drafting. It uses your own
Anthropic or OpenAI API key (**Settings → AI**) — with no key, it is simply off.
When you use it, content goes directly to the provider you chose: your messages
and conversation history, the contents of files the assistant reads to answer
you, and short file previews for the catalog summaries (on rebuild, or
automatically after a save if **Auto-summarize on save** is enabled).

Retention follows your provider's API terms. Desk shows a one-time disclosure
before your first request; review it anytime under **Settings → AI → Data &
Privacy**.

## License

[GPL-3.0-or-later](./LICENSE). You're free to use, modify, and share desk.md.
Because the GPL is copyleft, any distributed fork or derivative must also remain
open-source under the GPL.
