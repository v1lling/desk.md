<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.png">
    <img src="assets/banner-light.png" alt="desk.md: local-first project & task management in plain Markdown" width="100%">
  </picture>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License: GPL-3.0-or-later" src="https://img.shields.io/badge/license-GPL--3.0-blue.svg"></a>
  <img alt="Built with Tauri" src="https://img.shields.io/badge/built%20with-Tauri-24C8DB.svg?logo=tauri&logoColor=white">
  <img alt="Platform: macOS" src="https://img.shields.io/badge/platform-macOS-111111.svg?logo=apple&logoColor=white">
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/tasks-dark.png">
    <img src="assets/tasks-light.png" alt="The desk.md task board" width="100%">
  </picture>
</p>

desk.md is a desktop app for running your work (projects, tasks, docs, and
meetings), stored as plain Markdown files on your own machine. Think of
Obsidian's local Markdown vault, but built around **projects and task tracking**
instead of note-graphs.

- **Own your data.** Plain Markdown with YAML frontmatter in an ordinary
  folder. No database, no lock-in. Open it in any editor, including Obsidian.
- **Local-first.** Works fully offline. No account, no mandatory cloud.
- **Organized by workspace.** One workspace per client, side project, or area of
  life, each with its own projects, tasks, docs, and meetings.
- **Structured task tracking.** Statuses, priorities, due dates, Kanban/list
  views, and a quick-capture inbox for triage.
- **Agent-ready.** The folder is laid out so any AI agent picks up your full
  context instantly. No plugins, no MCP server, just files.

## Why I built it

For years I hacked local-first Markdown editors into project managers.
Never quite satisfied. SaaS tools work, but I didn't want my work locked inside
something I couldn't `grep`.

So I built desk.md, and I use it every day for my work. It's
agent-friendly by design: the data is just plain files, so I can point Claude
Code, Codex, or Gemini CLI at a workspace with no setup at all.

## A look around

<table>
  <tr>
    <td width="50%">
      <a href="assets/dashboard-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/dashboard-dark.png"><img src="assets/dashboard-light.png" alt="Dashboard"></picture></a>
      <p align="center"><sub><b>Dashboard</b>: capture, focus, and workspace progress</sub></p>
    </td>
    <td width="50%">
      <a href="assets/projects-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/projects-dark.png"><img src="assets/projects-light.png" alt="Projects"></picture></a>
      <p align="center"><sub><b>Projects</b>: an overview with task stats and quick links</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <a href="assets/docs-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/docs-dark.png"><img src="assets/docs-light.png" alt="Docs"></picture></a>
      <p align="center"><sub><b>Docs</b>: a WYSIWYG Markdown editor with a file tree</sub></p>
    </td>
    <td width="50%">
      <a href="assets/meetings-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/meetings-dark.png"><img src="assets/meetings-light.png" alt="Meetings"></picture></a>
      <p align="center"><sub><b>Meetings</b>: notes and action items, per project</sub></p>
    </td>
  </tr>
</table>

## Who is it for?

Anyone who'd rather keep their work in local Markdown files: indie developers,
writers, students, makers, and freelancers juggling a stack of clients, with
one workspace each.

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Desktop: Tauri 2
- UI: shadcn/ui
- State: Zustand + TanStack Query
- Storage: Local Markdown files in a folder you choose (default `~/Desk/`)

## Quick Start

desk.md is a Tauri desktop app. To run it from source:

```bash
npm install
npm run dev          # Browser with mock data (fast UI loop, no Rust needed)
npm run tauri:dev    # Desktop app with the real file system
```

> Use Node 22. Newer versions currently break Rollup's native dependency.
> See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full setup.

## Data & files

desk.md stores user content under `workspaces/` and app metadata under `.desk/`,
inside the data folder you pick at setup (default `~/Desk/`). One workspace is
the **home workspace**, which holds the quick-capture inbox and is created the
first time you set up desk.md. Everything is plain Markdown: back it up, sync it,
or edit it in another app whenever you like.

## AI & agents

desk.md is not an AI agent framework. It's a project, task and doc manager you
run yourself; it just happens to be friendly to agents too. AI here is entirely
optional, and nothing leaves your machine unless you reach for it. It comes in
two forms.

**Bring your own agent.** desk.md keeps your data folder agent-ready. Alongside
your Markdown it auto-generates `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` — so
Claude Code, Codex, and Gemini CLI all understand your workspaces with zero
setup — plus a per-workspace `WORKSPACE_CONTEXT.md` that catalogs and summarizes
every file. These spell out the folder layout, the frontmatter schemas, and the
`ai-docs/` area an agent writes to so it never clutters your own notes. No MCP
server, no plugins, just files.

**In-app assistant.** There's also a built-in assistant for chat and drafting. It
uses your own Anthropic or OpenAI API key (**Settings → AI**). With no key, it
is simply off. When you use it, content goes directly to the provider you chose;
desk.md shows a one-time disclosure before the first request, reviewable anytime
under **Settings → AI → Data & Privacy**.

## Contributing

Bug reports, feature ideas, and pull requests are welcome. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for setup and guidelines. This project
follows a [Code of Conduct](./CODE_OF_CONDUCT.md), and security issues have their
own [policy](./SECURITY.md).

To regenerate the screenshots above after a UI change: `npm run screenshots`.

## License

[GPL-3.0-or-later](./LICENSE). You're free to use, modify, and share desk.md.
Because the GPL is copyleft, any distributed fork or derivative must also stay
open-source under the GPL.
