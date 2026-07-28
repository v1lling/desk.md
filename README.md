<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.png">
    <img src="assets/banner-light.png" alt="desk.md, personal work management in plain Markdown" width="75%">
  </picture>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License: GPL-3.0-or-later" src="https://img.shields.io/badge/license-GPL--3.0-blue.svg"></a>
  <img alt="Built with Tauri" src="https://img.shields.io/badge/built%20with-Tauri-24C8DB.svg?logo=tauri&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=white">
</p>

desk.md is a personal workspace for projects, tasks, documents, and meetings.
It combines a calm interface for daily work with a plain-Markdown source of
truth that remains accessible to both people and agents.

I built it for my own freelance and personal work, and I use it every day.

## Two jobs, one source of truth

### A calm place to run your work

Workspaces, project overviews, task boards, documents, meetings, quick capture,
and a weekly planner live in one coherent app. The work model is built in rather
than assembled and maintained from plugins.

### A source of truth agents can use

Work content is stored as Markdown with readable YAML frontmatter. Local agents
can work with the folder directly; a self-hosted Desk server exposes the same
information through an OAuth-protected MCP endpoint.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/tasks-dark.png">
    <img src="assets/tasks-light.png" alt="The desk.md Kanban task board" width="100%">
  </picture>
</p>

## Built for one person running real work

Desk is especially useful for freelancers, consultants, developers, makers, and
other independent people who manage several streams of work and care about
owning their data.

- **Projects with orientation.** Every workspace and project has a user-owned
  Markdown overview, plus its tasks, documents, meetings, and recent activity.
- **Tasks and planning.** Kanban and list views, priorities, due dates, quick
  capture, status filters, and a weekly time-block planner.
- **Documents and meetings.** A WYSIWYG Markdown editor, nested folders, meeting
  notes, and drag-and-drop conversion from Word, PDF, Excel, CSV, and HTML.
- **A focused daily UI.** Workspace switching, persistent editor tabs, global
  search, keyboard shortcuts, and protection for unsaved work.
- **Files that remain files.** Ordinary filesystem tools can open, back up, sync,
  search, and version the workspace. Hosted authentication uses SQLite; work
  content remains in Markdown.

Desk is intentionally a single-user product today. It is not a team PM system
with assignments, permissions, or real-time collaboration.

## Agents without an AI workspace takeover

Desk has no in-app chatbot. It organizes durable source material for external
AI tools.

- **Local filesystem access.** Desk can generate `CLAUDE.md`, `AGENTS.md`,
  `GEMINI.md`, and per-workspace `WORKSPACE_INDEX.md` files so local agents
  understand the structure and read the right overview first.
- **Hosted MCP access.** A self-hosted server lets Claude, ChatGPT, Claude Code,
  and other MCP clients browse, search, and read the workspace over OAuth. MCP
  tools are read-only for now.
- **Optional Smart Index.** An Anthropic or OpenAI API key enables a summarized
  catalog that helps agents find relevant files quickly.
- **Explicit boundaries.** `.aiignore` excludes content from the Smart Index and
  Desk's agent read layer, while generated local guidance carries the same
  boundary. `author: ai` records provenance without creating a separate AI
  content system.

## Local or self-hosted

Both modes use the same Markdown structure. The difference is where the files
live and how they are reached.

| | **Local desktop** | **Self-hosted server** |
|---|---|---|
| Use it from | Native app on macOS, Windows, or Linux | Hosted web app, or the native app connected to the server |
| Data location | A folder on the local machine | A bind-mounted folder on the server |
| Network and login | Fully offline, no account | Account-protected, available across devices |
| Multi-device access | External sync if needed | One shared server-side copy |
| Agent connection | Filesystem plus generated agent files | OAuth-protected, read-only MCP |
| Smart Index key | Operating-system keychain | Server environment variable |

Moving between the two does not require a content migration. Hosting adds
`.desk/auth.sqlite` for accounts and sessions; workspaces remain Markdown files.

## Get started

### Install the desktop app

Desktop builds are available from the
[latest release](https://github.com/v1lling/desk.md/releases/latest). Desk keeps
itself up to date after installation.

Desk is developed and tested primarily on macOS. Windows and Linux builds are
**beta**, and the desktop builds are not code-signed yet.

<details>
<summary>Unsigned build notes</summary>

- **macOS:** Download `Desk_*.dmg` and drag **Desk** into Applications. If macOS
  says the app is damaged, run
  `xattr -dr com.apple.quarantine /Applications/Desk.app` once.
- **Windows:** Download the `.exe` installer. In the SmartScreen warning, choose
  **More info → Run anyway**.
- **Linux:** Use the `.AppImage`, `.deb`, or `.rpm`. Make an AppImage executable
  with `chmod +x Desk_*.AppImage`. AI keys require a desktop secret service such
  as GNOME Keyring or KWallet.

</details>

### Self-host

One Docker container serves the web app, domain API, OAuth server, and MCP
endpoint while keeping work content as Markdown on the server:

```bash
cd deploy
cp .env.example .env
# set BETTER_AUTH_SECRET
docker compose up -d
```

See the [self-hosting guide](./deploy/README.md) for HTTPS, reverse-proxy, AI,
and MCP setup.

## More of the app

<table>
  <tr>
    <td width="50%">
      <a href="assets/projects-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/projects-dark.png"><img src="assets/projects-light.png" alt="Project home with its overview and recent activity"></picture></a>
      <p align="center"><sub><b>Project home</b></sub></p>
    </td>
    <td width="50%">
      <a href="assets/planner-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/planner-dark.png"><img src="assets/planner-light.png" alt="Weekly planner"></picture></a>
      <p align="center"><sub><b>Weekly planner</b></sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <a href="assets/docs-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/docs-dark.png"><img src="assets/docs-light.png" alt="Document tree and Markdown editor"></picture></a>
      <p align="center"><sub><b>Documents</b></sub></p>
    </td>
    <td width="50%">
      <a href="assets/meetings-light.png"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/meetings-dark.png"><img src="assets/meetings-light.png" alt="Meeting notes"></picture></a>
      <p align="center"><sub><b>Meetings</b></sub></p>
    </td>
  </tr>
</table>

## Roadmap

Ideas being explored:

- MCP write tools for explicitly requested notes and tasks
- Local-model support for the Smart Index
- Better mobile-web capture and review
- Lightweight project timelines, milestones, and task dependencies

## Run from source

Desk is an npm-workspaces monorepo: `@desk/core` contains the shared domain,
`@desk/app` contains the React/Tauri client, and `@desk/server` provides the
self-hosted web, API, OAuth, and MCP services.

```bash
npm install
npm run dev          # browser with mock data
npm run tauri:dev    # desktop app with the real filesystem
```

Use Node 22. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the complete setup and
project guidelines.

## Contributing

Bug reports, feature ideas, documentation improvements, and pull requests are
welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[GPL-3.0-or-later](./LICENSE). Desk may be used, modified, and shared;
distributed forks and derivatives must remain open source under the GPL.
