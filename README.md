<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.png">
    <img src="assets/banner-light.png" alt="desk.md, project and task management in plain Markdown" width="100%">
  </picture>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License: GPL-3.0-or-later" src="https://img.shields.io/badge/license-GPL--3.0-blue.svg"></a>
  <img alt="Built with Tauri" src="https://img.shields.io/badge/built%20with-Tauri-24C8DB.svg?logo=tauri&logoColor=white">
  <img alt="macOS: stable" src="https://img.shields.io/badge/macOS-stable-3fb950.svg?logo=apple&logoColor=white">
  <img alt="Windows: beta" src="https://img.shields.io/badge/Windows-beta-f59e0b.svg?logo=windows&logoColor=white">
  <img alt="Linux: beta" src="https://img.shields.io/badge/Linux-beta-f59e0b.svg?logo=linux&logoColor=white">
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/tasks-dark.png">
    <img src="assets/tasks-light.png" alt="The desk.md task board" width="100%">
  </picture>
</p>

desk.md is a local-first desktop app for running your projects (tasks, docs,
and meetings) as plain Markdown files. Think of Obsidian's local vault, but
with project management built in from the first launch.

- **Own your data.** Plain Markdown with YAML frontmatter in an ordinary
  folder. No database, no lock-in. Open it in any editor, like Obsidian.
- **Built in, not bolted on.** Project management works on first launch:
  Workspace → Project → Tasks/Docs/Meetings with statuses, priorities, due
  dates, Kanban/list views, and a quick-capture inbox. No plugins to assemble.
- **Agent-ready.** Every doc you write is potential context for an AI agent,
  and nobody's going to re-explain their work every session. desk.md
  auto-generates `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, and a per-workspace
  catalog in the background. No plugins, no MCP server, just files.
- **Local-first.** Works fully offline. No account, no mandatory cloud.
- **Organized by workspace.** One workspace per client, side project, or area of
  life, each with its own projects, tasks, docs, and meetings.

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


## Install

> Windows and Linux builds are **beta**. desk.md is developed and tested on macOS. Please
> [report anything broken](https://github.com/v1lling/desk.md/issues).

### macOS

1. Download `Desk_*.dmg` from the
   [latest release](https://github.com/v1lling/desk.md/releases/latest). One
   universal build runs on both Apple Silicon and Intel Macs.
2. Open the DMG and drag **Desk** into Applications.
3. The app isn't notarized by Apple yet, so macOS reports it as "damaged" on the
   first launch. Clear the quarantine flag once, from Terminal:

   ```bash
   xattr -dr com.apple.quarantine /Applications/Desk.app
   ```

### Windows (beta)

Download and run the `.exe` installer from the
[latest release](https://github.com/v1lling/desk.md/releases/latest). The app
isn't code-signed yet, so SmartScreen shows a warning. Click **More info → Run
anyway**.

### Linux (beta)

Download the `.AppImage` (runs on most distros) or a `.deb` / `.rpm` from the
[latest release](https://github.com/v1lling/desk.md/releases/latest). For the
AppImage, `chmod +x Desk_*.AppImage` and run it. Storing AI API keys needs a
desktop secret service (GNOME Keyring or KWallet), present on most desktop
installs.

desk.md keeps itself up to date automatically after install. Prefer to build it
yourself? See [Quick Start](#quick-start).

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Desktop: Tauri 2
- UI: shadcn/ui
- State: Zustand + TanStack Query
- Storage: Local Markdown files in a folder you choose (default `~/Desk/`)

## Data & files

desk.md stores user content under `workspaces/` and app metadata under `.desk/`,
inside the data folder you pick at setup (default `~/Desk/`). One workspace is
the **home workspace**, which holds the quick-capture inbox and is created the
first time you set up desk.md. Everything is plain Markdown: back it up, sync it,
or edit it in another app whenever you like.

## AI & agents

desk.md isn't an AI dev tool or an autonomous agent platform. It's a
work-management app that uses AI in two specific ways.

**Sparring partner.** A built-in chat assistant for the thinking work:
brainstorming, sparring on decisions, working through technical problems,
drafting emails. Uses your own Anthropic or OpenAI API key
(**Settings → AI**); without a key, it's off. Content goes directly to the
provider you chose; a one-time disclosure runs before the first request,
reviewable under **Settings → AI → Data & Privacy**.

**Bring your own agent.** Because your data is just a folder of Markdown,
external agents (Claude Code, Codex, Gemini CLI) can open it too. desk.md
auto-generates `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, and a per-workspace
`WORKSPACE_CONTEXT.md` catalog so they understand your workspaces with zero
setup. No MCP server, no plugins.

## Run from source

desk.md is a Tauri desktop app. To run it from source:

```bash
npm install
npm run dev          # Browser with mock data (fast UI loop, no Rust needed)
npm run tauri:dev    # Desktop app with the real file system
```

> Use Node 22. Newer versions currently break Rollup's native dependency.
> See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full setup.

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
