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
stored as plain Markdown files you own, and structured so an AI agent can find
its way around them. It runs as an offline desktop app, or you can self-host it
and connect Claude, ChatGPT, or Claude Code to your work over MCP.

I built it for my own work and use it every day to keep track of everything from
client projects to personal tasks. The point isn't to generate the notes, it's to
have a nice note-taking and project-management environment that happens to keep
real context somewhere an agent can reach it in a structured way.

- **Projects and tasks.** Workspaces, projects, tasks, docs, and meetings as real
  things, with statuses, priorities, due dates, Kanban or list views, a week
  planner, and a quick-capture inbox. Built in, not assembled out of plugins.
- **Plain Markdown.** YAML frontmatter in an ordinary folder. No database, no
  lock-in, nothing to export, since the files already are the format. Drag in
  Word, PDF, Excel, CSV, or HTML and they convert to Markdown docs.
- **Agents can navigate it.** The Smart Index summarizes your files into a catalog
  agents can search, and desk.md writes `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md`
  so local coding agents understand your projects without you re-explaining them
  every session.
- **MCP from anywhere.** Self-host desk.md and your workspace becomes an
  OAuth-protected MCP endpoint, so you can browse, search, and read your projects
  from claude.ai, ChatGPT, or your phone. Not a localhost port that needs the app
  awake on one machine.
- **Local or self-hosted.** Run fully offline on your desktop, or host it on your
  own server for browser/PWA access and MCP.

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

## Why not just Obsidian?

Obsidian gives you notes with properties. Everything above (projects, task
statuses, boards, meetings) you assemble yourself out of community plugins, and
the stack is fragile: the Projects plugin, which came closest to this, was
discontinued in 2025. Bases covers tables and cards now, but Kanban still isn't there, and every schema is one you define and maintain.

desk.md has the model built in, and the agent side is a real difference: desk.md self-hosts an OAuth-protected MCP endpoint, so your work is reachable from claude.ai or your phone.

The files stay plain Markdown either way, so nothing stops you opening them in
Obsidian, an editor, or `grep`. You just won't need to.

## AI & agents

desk.md isn't an agent platform. It keeps your context organized and reachable,
then lets AI tools read it when you want them to. There's no chat box in the app;
the sparring happens in the tool you already use, with desk.md underneath it as
the source of truth.

**Records and context.** Your files split by lifecycle. Docs, tasks and meetings are
**records**: they are dated, they accumulate, and nothing rewrites them. A March
meeting note stays a March meeting note, so a record cannot go stale. Everything an
agent needs to actually understand the work lives in **context**, a small folder kept
current: what this is, which systems it touches, what was decided.

**The brief and the current state.** Each project's context holds two small files with
a clean line between them. The **brief** is yours: what this project is and what it runs
on, the part no AI can work out for itself. The **current state** is the AI's: a short
snapshot of where the project stands, rewritten in the background as your tasks, docs,
and meetings change, and marked as AI-written right in the file. This runs wherever your
data lives: on your desktop with your local key, or on your own server when self-hosted.
desk.md tracks how many records the snapshot hasn't seen yet, so you can tell a current
map from a rotting one at a glance.

Your words are protected structurally, not by asking the model nicely: the AI only ever
writes its own file, so nothing you wrote is ever in an AI write path.

**Smart Index.** Optional, and off until you add your own Anthropic or OpenAI key
(**Settings → AI**). It summarizes your files into a catalog so agents can find
the right note fast instead of crawling the whole folder.

**Local agent files.** Because your data is just Markdown, local tools like Claude
Code, Codex, and Gemini CLI can open the folder directly. desk.md writes
`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, and `WORKSPACE_CONTEXT.md` so those agents
know what they're looking at.

**Hosted MCP.** If you self-host desk.md, the server exposes an MCP endpoint over
OAuth. Claude.ai, ChatGPT, Claude Code, and other MCP clients can browse, search,
and read your workspace over the network. Useful for questions like "what did we
decide about this project?", "find the latest client notes", or "draft a reply
using the related meeting notes and tasks". The tools are read-only for now;
letting an agent file something back when you ask it to is on the roadmap.

## Running it: local or self-hosted

desk.md runs the same app two ways. Installed locally, it's an offline desktop app
that reads and writes Markdown straight from your disk. Self-hosted, the same app
runs on a server you control, so you can reach your desk from a browser or phone
and let AI tools connect over the network. Either way your data stays plain
Markdown you own; the difference is where it lives and who can reach it.

| | **Local** (desktop app) | **Self-hosted** (your server) |
|---|---|---|
| Install | Native app on Mac, Windows, Linux | `docker compose` on a box you control |
| Reach it from | The one machine it runs on | Any browser, on any device, all sharing one copy. Installable as a PWA on phone and tablet |
| Where data lives | A folder you pick at setup (default `~/DeskMD/`) | A folder on the server you bind-mount into the container |
| Multi-device sync | Your own tool (iCloud, Dropbox, git, Syncthing) | Built in, the server holds the shared copy |
| Login | None, fully offline | Account and session (first user wins), needs the network |
| Smart Index | Yes, with your own API key | Built by the server with its own key (set it in the deploy .env), so browser and phone get it too |
| External AI agents | Point Claude Code, Codex, or Gemini at the folder | Connect Claude.ai, ChatGPT, Claude Code, or any MCP client to your workspace |
| MCP | No server needed; agents read local files | OAuth-protected MCP endpoint, read-only for now |

Both modes write the same folder: your Markdown under `workspaces/`, app metadata
under `.desk/`. So a folder made by the desktop app can be handed to a server, and
back, with nothing to migrate. Hosting adds one file, `.desk/auth.sqlite`, for
accounts and sessions. Everything else is Markdown you can open, back up, or `git`
like any other directory.

> The native desktop app can also point at a self-hosted server instead of local
> disk, giving you the desktop UI on top of server-side data.

Self-hosting is one container (`docker compose up`) that serves the web/PWA app,
the API, the OAuth server, and the MCP endpoint. See
[deploy/README.md](./deploy/README.md).

## Install

Download the build for your OS from the
[latest release](https://github.com/v1lling/desk.md/releases/latest). desk.md
then keeps itself up to date automatically. To build from source, see
[Run from source](#run-from-source).

> Windows and Linux builds are **beta**. desk.md is developed and tested on
> macOS. Please [report anything broken](https://github.com/v1lling/desk.md/issues).

- **macOS** (`Desk_*.dmg`, one universal build for Apple Silicon and Intel). Drag
  **Desk** into Applications. The app isn't notarized by Apple yet, so macOS
  calls it "damaged" on first launch. Clear the quarantine flag once:
  `xattr -dr com.apple.quarantine /Applications/Desk.app`
- **Windows** (`.exe` installer). Not code-signed yet, so SmartScreen warns:
  **More info → Run anyway**.
- **Linux** (`.AppImage`, `.deb`, or `.rpm`). For the AppImage,
  `chmod +x Desk_*.AppImage` and run it. Storing AI API keys needs a desktop
  secret service (GNOME Keyring or KWallet), present on most desktop installs.

To self-host instead, see [deploy/README.md](./deploy/README.md).

## Roadmap

Ideas I'm exploring:

- More project-management depth, still lightweight: timelines, milestones, task
  dependencies
- MCP write tools, so an agent can file a note or a task back into the workspace
  when you ask it to
- Ollama support, so the Smart Index can run on a fully local model
- Server-side AI, so self-hosted installs get the Smart Index without a desktop
- Mobile polish: make the hosted PWA better for quick capture and read-only review
- Time tracking: log time on tasks with simple per-project reports

## Run from source

desk.md is organized as an npm-workspaces monorepo under `packages/`: `@desk/core`
for the domain layer, `@desk/app` for the Tauri and React UI, and `@desk/server`
for the Node/Hono self-host server with the domain API, web/PWA, OAuth, and MCP.
All commands run from the repo root:

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
