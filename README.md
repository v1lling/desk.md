<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.png">
    <img src="assets/banner-light.png" alt="desk.md, project and task management in plain Markdown" width="75%">
  </picture>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License: GPL-3.0-or-later" src="https://img.shields.io/badge/license-GPL--3.0-blue.svg"></a>
  <img alt="Built with Tauri" src="https://img.shields.io/badge/built%20with-Tauri-24C8DB.svg?logo=tauri&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=white">
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/tasks-dark.png">
    <img src="assets/tasks-light.png" alt="The desk.md task board" width="100%">
  </picture>
</p>

desk.md is a local-first workspace for projects, tasks, docs, and meetings,
stored as plain Markdown files. Use it as an offline desktop app, or self-host
it and let Claude, ChatGPT, and other AI tools read your workspace through MCP.
Think Obsidian-style file ownership, but with lightweight project management
and agent-ready context built in.

- **Plain Markdown.** YAML frontmatter in an ordinary folder. No database,
  no lock-in. Drag in Word, PDF, Excel, CSV, or HTML files and they convert to Markdown docs.
- **Project management.** Workspaces, projects, tasks, docs, and meetings,
  with statuses, priorities, due dates, Kanban or list views, and a
  quick-capture inbox in the home workspace.
- **AI-ready context.** desk.md generates `CLAUDE.md`, `AGENTS.md`,
  `GEMINI.md`, and per-workspace context files, so local coding agents can
  understand your projects without you re-explaining them every session.
- **MCP for Claude and ChatGPT.** Self-host desk.md and connect AI tools to
  your Markdown workspace over a read-only, OAuth-protected MCP endpoint. They
  can browse, search, and read your docs, tasks, and meetings without getting
  write access.
- **Local or self-hosted.** Run fully offline on your desktop, or host it on
  your own server for browser/PWA access and MCP.

## Screenshots

<table>
  <tr>
    <td width="50%">
      <a href="assets/dashboard-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/dashboard-dark.png"><img src="assets/dashboard-light.png" alt="Dashboard"></picture></a>
      <p align="center"><sub><b>Dashboard</b></sub></p>
    </td>
    <td width="50%">
      <a href="assets/projects-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/projects-dark.png"><img src="assets/projects-light.png" alt="Projects"></picture></a>
      <p align="center"><sub><b>Projects</b></sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <a href="assets/docs-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/docs-dark.png"><img src="assets/docs-light.png" alt="Docs"></picture></a>
      <p align="center"><sub><b>Docs</b></sub></p>
    </td>
    <td width="50%">
      <a href="assets/meetings-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/meetings-dark.png"><img src="assets/meetings-light.png" alt="Meetings"></picture></a>
      <p align="center"><sub><b>Meetings</b></sub></p>
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

desk.md keeps itself up to date automatically after install. To build from
source, see [Run from source](#run-from-source) below.

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
or edit it in another app.

## AI & agents

desk.md isn't an autonomous agent platform. It's a work-management app that
keeps your context organized, then lets AI tools read that context when you want
them to.

**Sparring partner.** A built-in chat assistant for the thinking work:
brainstorming, sparring on decisions, working through technical problems,
drafting emails. Uses your own Anthropic or OpenAI API key
(**Settings → AI**); without a key, it's off.

**Local agent files.** Because your data is just Markdown, local tools like
Claude Code, Codex, and Gemini CLI can open the folder directly. desk.md writes
`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, and `WORKSPACE_CONTEXT.md` so those
agents know what they are looking at.

**Hosted MCP.** If you self-host desk.md, the server exposes a read-only MCP
endpoint. Claude.ai, ChatGPT, Claude Code, and other MCP clients can browse,
search, and read your workspace over the network. Useful for questions like
"what did we decide about this project?", "find the latest client notes", or
"draft a reply using the related meeting notes and tasks". Authentication uses
OAuth, and the MCP tools do not get write access.

## Running it: local or self-hosted

desk.md runs the same app two ways. Installed locally, it's an offline desktop
app that reads and writes Markdown straight from your disk. Self-hosted, the same
app runs on a server you control, so you can reach your desk from a browser or
phone and let AI tools connect over the network. Either way your data stays plain
Markdown you own; the difference is where it lives and who can reach it.

| | **Local** (desktop app) | **Self-hosted** (your server) |
|---|---|---|
| Install | Native app on Mac, Windows, Linux | `docker compose` on a box you control |
| Reach it from | The machine it runs on | Any browser, installable as a PWA on phone and tablet |
| Devices | One | Many, all sharing one copy |
| Where data lives | Your local disk | The server's disk |
| On-disk format | Plain Markdown you own | Plain Markdown you own |
| Multi-device sync | Your own tool (iCloud, Dropbox, git, Syncthing) | Built in, the server holds the shared copy |
| Login | None, fully offline | Account and session (first user wins), needs the network |
| In-app AI assistant | Yes, with your own API key | Yes, with a key on the server |
| External AI agents | Point Claude Code, Codex, or Gemini at the folder | Connect Claude.ai, ChatGPT, Claude Code, or any MCP client to your workspace |
| MCP | No server needed; agents read local files | Read-only OAuth-protected MCP endpoint |

> The native desktop app can also point at a self-hosted server instead of local
> disk, giving you the desktop UI on top of server-side data.

Self-hosting is one container (`docker compose up`) that serves the web/PWA app, the
API, the OAuth server, and the MCP endpoint. See [deploy/README.md](./deploy/README.md).

## Roadmap

Ideas I'm exploring:

- More project-management depth, still lightweight: timelines, milestones,
  task dependencies
- Ollama support for the assistant, so AI can run fully local
- Mobile polish: make the hosted PWA better for quick capture and read-only review
- Time tracking: log time on tasks with simple per-project reports

## Run from source

desk.md is organized as an npm-workspaces monorepo under `packages/`:
`@desk/core` for the domain layer, `@desk/app` for the Tauri and React UI, and
`@desk/server` for the Node/Hono self-host server with the domain API, web/PWA,
OAuth, and MCP. All commands run from the repo root:

```bash
npm install
npm run dev          # Browser with mock data (fast UI loop, no Rust needed)
npm run tauri:dev    # Desktop app with the real file system
```

> Use Node 22. Newer versions currently break Rollup's native dependency.
> See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full setup.

## Contributing

Bug reports, feature ideas, and pull requests are welcome. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for setup and guidelines.

To regenerate the screenshots above after a UI change: `npm run screenshots`.

## License

[GPL-3.0-or-later](./LICENSE). You're free to use, modify, and share desk.md.
Because the GPL is copyleft, any distributed fork or derivative must also stay
open-source under the GPL.
