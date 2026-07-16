# desk.md - Local-First Work Management

> Desktop app to manage workspaces, projects, tasks, docs, and meetings — all as local Markdown files you own.

## Quick Start

All commands run from the repo root. The root `package.json` is an npm-workspaces
manifest; each script delegates to the relevant package (`-w @desk/app` / `@desk/server`).

```bash
npm run dev          # Browser with mock data (port 3001) — @desk/app
npm run tauri:dev    # Desktop with real file system — @desk/app
npm run build        # Type-check + production web build — run before committing — @desk/app
npm run typecheck    # tsc --noEmit across core, app, and server
npm run lint         # ESLint (flat config in packages/app/eslint.config.mjs)
npm run tauri:build  # Production desktop build — @desk/app
npm run dev:server   # Run the @desk/server skeleton (tsx watch)
```

> Build/dev require Node 22 (nvm). Node 24 breaks rollup's native binary. There is no test runner — there is no `test` script; verify changes via `npm run build` + manual run.

## Monorepo Layout

The codebase is an npm-workspaces monorepo under `packages/`:

| Package | Path | Role |
|---------|------|------|
| `@desk/core` | `packages/core` | **Pure domain layer** — parser, CRUD, file-cache, search, storage. No React / Zustand / Tauri-static imports. Tauri is reached only through guarded dynamic imports declared as optional `peerDependencies`. Runs in the Tauri webview, the browser, or on Node. |
| `@desk/app` | `packages/app` | **Tauri + React UI.** Owns everything UI-coupled: components, pages, stores, hooks, and the React-bound libs (`lib/ai`, `lib/context-index`, `lib/email`, `lib/i18n`, file-cache React hooks, `desk-watcher`). Consumes `@desk/core` and wires its host seams at boot. |
| `@desk/server` | `packages/server` | **Node 22 + Hono skeleton** that boots the same `@desk/core` domain on a `NodeFsProvider`. WIP — no auth / MCP / remote service yet. |

`@desk/app` resolves `@desk/core` straight to its TypeScript source (no build step):
a Vite alias in `packages/app/vite.config.ts` and npm-workspace symlinks point at
`packages/core/src`. The server consumes core as source via `tsx`.

**Host seams (dependency injection).** `@desk/core` is UI/runtime-agnostic; three
couplings are injectable registries (set/get) that the host wires before any domain call:

| Seam | Setter | app wires it to | server wires it to |
|------|--------|-----------------|--------------------|
| Data root | `setDataRootResolver` | boot store `dataPath` | `DESK_DATA_ROOT` env |
| Storage | `setStorage` | `TauriProvider` / `BrowserProvider` | `NodeFsProvider` |
| Editor notify | `setEditorNotifier` | open-editor registry | no-op default |
| Agent-context write | `setAgentContextWriter` | `lib/context-index` | no-op default |
| AI key | `setAIKeyResolver` | OS Keychain (`lib/ai/secrets`) | env (`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`) |

The app wires these in [packages/app/src/main.tsx](packages/app/src/main.tsx); the server in [packages/server/src/boot.ts](packages/server/src/boot.ts).

## Core Concept

```
Workspace (any area of work — a client, side project, or life area)
├── context/              (the map — evergreen, maintained)
├── Workspace-level Docs
├── _unassigned/          (tasks without a project)
├── _capture/             (home workspace only - triage inbox)
└── Projects
    └── Project
        ├── context/      (the map, per project)
        ├── Tasks, Docs, Meetings

The home workspace (frontmatter `home: true`) holds the capture inbox and is always first in the list.
```

**"Work Mode" Navigation**: User selects active workspace via bottom selector. All views (Tasks, Docs, Meetings) filter to that workspace automatically.

### Records vs Context

Written material splits on **lifecycle, not authorship**. This is the load-bearing distinction
in the data model, and getting it backwards is the mistake the old `ai-docs/` folder made.

- **Records** — `docs/`, `tasks/`, `meetings/`. Dated. They accumulate and are never rewritten.
  A March meeting note stays a March meeting note; research "as of May" stays true of May.
  Because a record only ever claimed to be true of its date, **a record cannot go stale**, and
  records are allowed to grow without bound.
- **Context** — `context/`, at the workspace root and each project root. The map: what this is,
  which systems it touches, what was decided. Evergreen, deliberately small, kept current. It is
  the **only** layer that can go stale, hence the only one with a refresh mechanism.

Both the user and AI write both kinds. Who typed a file is `Doc.author` (`'ai'`, or absent for the
user) — frontmatter, orthogonal to the directory, surfaced in the UI as a badge + filter. Do not
reintroduce an authorship-shaped directory: the axis does not hold (an AI can write the user's
website copy; the user can hand-write a context file for the agent).

`DocKind = 'doc' | 'context'` selects the directory and is always **derived from the path**, never
stored in frontmatter.

The conventions agents see live in **one** constant, `DESK_SPACE_NORMS`
([packages/core/src/desk/norms.ts](packages/core/src/desk/norms.ts)), rendered into the generated
`CLAUDE.md`/`AGENTS.md`/`GEMINI.md` (local mode), `WORKSPACE_CONTEXT.md`'s legend, and the MCP
server's `instructions` (hosted mode). Change the norms there, not in the renderers.

**Context and the Smart Index are complementary, not rivals.** The Smart Index is the *catalog*
(one line per file, complete, mechanical, always current) and answers "where is the thing I need?".
Context is the *narrative* (small, judged, maintained) and answers "what is going on here?". An
agent can read a 227-line `WORKSPACE_CONTEXT.md` and still not know what the workspace *is*. Ship
both, composed: context first, index below.

### The brief and the state file

A project's map is **two files, split by author** — the split IS the safety mechanism, replacing
the old section-merge machinery (`mergeAISections`, deleted) with a structural guarantee: AI only
ever writes its own file, so the user's words are never in an AI write path at all.

- **The brief** (`context/YYYY-MM-DD-brief.md`) is **fully human**. Two seeded sections, `What
  this is` and `Systems & stack` — the intent that cannot be derived from records. AI never
  writes it (the norms tell agents it is read-only). A project with nothing seeded gets **no
  file**: an empty brief of bare headings looks done and is noise to an agent.
- **The state file** (`context/YYYY-MM-DD-state.md`, title "Current state", `author: ai`) is
  **fully AI-maintained**. The app owns its lifecycle — path, filename, frontmatter — via
  `writeProjectState` ([packages/core/src/desk/project-state.ts](packages/core/src/desk/project-state.ts));
  the model only supplies the body, rewritten wholesale ("reconcile, don't append").
- **Identity is the frozen slug, never the title** for both files. `findProjectBrief` /
  `findProjectState` resolve by filename ([packages/core/src/desk/project-brief.ts](packages/core/src/desk/project-brief.ts));
  the title is display-only. Never locate either with `generateFilename(title)`. A
  `context/archive/…-state.md` is an old copy, not the live file (slash guard).

**The refresh runs itself — via the maintenance engine.** Every record write funnels through
core `file-operations.ts`, which publishes on the **domain-write bus**
([packages/core/src/desk/domain-write-bus.ts](packages/core/src/desk/domain-write-bus.ts)); the
**maintenance engine** ([packages/core/src/desk/maintenance/](packages/core/src/desk/maintenance/))
subscribes and schedules a per-project debounced (90s) state refresh plus a per-path debounced
(5s) Smart Index update. The engine runs on whichever host owns the data (app in local mode,
server in hosted mode); in local mode the Tauri watcher additionally feeds external file edits
into it (`notifyExternalChanges`). Gated at fire time by consent/env-key + the
`autoRefreshProjectState` toggle + `changedSince > 0`, which makes it self-terminating: writing
the state file zeroes the count. Context paths never schedule. The Context panel keeps a manual
refresh icon (`DeskService.refreshProjectState` — server-executed in hosted mode).

**Freshness is drift, not age — and it is scoped to the state file.** `computeContextFreshness`
([packages/core/src/desk/context-freshness.ts](packages/core/src/desk/context-freshness.ts)) counts
records newer than the state file's stamp. No day-count threshold: a stable project with a
six-month-old state is fine. **No state file + records = status `"never"`** and the whole history
becomes the reconcile set — a fresh brief on an old project must never read "up to date". The UI
says "reviewed", never "verified" (any save stamps `updated`).

## Tech Stack

- **Frontend**: Vite, React 19, React Router, TypeScript, Tailwind CSS, shadcn/ui
- **Desktop**: Tauri 2 (Rust shell)
- **State**: TanStack Query (server), Zustand (client)
- **Editor**: Tiptap (WYSIWYG markdown)
- **Drag & Drop**: @dnd-kit

> **Note**: `@desk/app` is a single-page app (SPA) built with Vite. No SSR, no API routes — Tauri bundles static files only. The "backend" is Tauri's Rust layer for file system access. The `@desk/server` package is the start of a real off-Tauri backend (sync/hosted), running the same `@desk/core` domain on Node; it is a WIP skeleton.

## Data Models

```typescript
type TaskStatus = 'backlog' | 'todo' | 'doing' | 'waiting' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';
type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';
type ContentScope = 'personal' | 'workspace' | 'project';
```

### Names & dates (the contract)

- **Filename = frozen identifier.** Files are `YYYY-MM-DD-slug.md` (`generateFilename`), assigned once
  at creation and **never renamed** when the title changes. The `slug` is the creation-time title and
  the date prefix is the **creation** day — both go stale by design; don't read meaning into them
  beyond "stable id". The item's `id` derives from the filename (`filenameToId`), so ids are stable
  across title edits and links never break.
- **`title` (frontmatter) = display name.** The editable name shown everywhere in the UI, in tabs,
  search, and to agents. Editing a title rewrites frontmatter only (docs-tree "Rename" included) — it
  never touches the filename.
- **`created` (frontmatter) = canonical metadata date.** Resolved via `resolveContentDate`:
  frontmatter → filename date-prefix → today (last resort only). Sorting, MCP `desk_catalog`, and the
  Smart Index all key off this. **OS file stat (`birthtime`/`mtime`) is never an agent-visible or
  canonical date** — it's unreliable across import/copy/sync; it survives only as a local docs-tree
  "modified" sort key.
- **One clock: local.** A date-only value is the **local** calendar day. Use `formatLocalISODate` /
  `todayISO()` (local) and never `new Date().toISOString().split('T')[0]` (UTC — off by a day near
  midnight). To *parse* a `YYYY-MM-DD` string for display, use date-fns `parseISO` or
  `formatLocaleDate` (both local); never `new Date("YYYY-MM-DD")` (UTC midnight → previous day in
  negative-offset zones). Compare due/created dates as **strings** (`a < b` is chronological for this
  format), e.g. `isOverdue` in `lib/format.ts`.
- **Never compare stamps of mixed precision as strings.** The rule above holds only *within* one
  format. `updated` is a UTC **datetime** and `created` is a local **date-only** day, and a date-only
  string is a *prefix* of a datetime, so it sorts **less**: `"2026-07-13" < "2026-07-13T09:00Z"`. A
  record created at 18:00 therefore reads as *older* than a brief refreshed at 09:00, which silently
  hides drift. `computeContextFreshness` compares **interval bounds** instead (a date-only value is a
  whole local day), taking records at their upper bound and context at its lower bound so ambiguity
  always resolves toward "stale". `compareDatesDesc` is fine for sorting display lists; it is not a
  soundness tool.

## Key Directories

**`@desk/core` (`packages/core/src/`) — domain layer:**

| Directory | Purpose |
|-----------|---------|
| `desk/` | Core CRUD operations |
| `desk/storage/` | `StorageProvider` — the single filesystem seam (Tauri / browser / Node server) |
| `desk/service/` | `DeskService` interface + `LocalDeskService` binding the domain functions |
| `desk/env.ts` | Data-root resolution, path joining, bootstrap (not I/O) |
| `desk/platform.ts` | Pure runtime checks (`isTauri`/`isMacOS`), dependency-free to avoid import cycles |
| `desk/agent-queries.ts` | Read-side queries (tree/read/search) for MCP + the Smart Index, backed by `StorageProvider` |
| `desk/project-brief.ts` | The brief (human): frozen-slug identity (`findProjectBrief`), idempotent `ensureProjectBrief` |
| `desk/project-state.ts` | The state file (AI): `findProjectState`, app-owned `writeProjectState` (model supplies only the body) |
| `desk/context-freshness.ts` | Has the state file drifted from the records? Pure, no clock, interval-bounds comparison, `"never"` for the adoption case |
| `desk/file-cache/` | File tree cache for list views (LRU cache) — pure logic only |
| `desk/ai/` | Runtime-agnostic AI layer: providers, `AIService`, prompts, `setAIKeyResolver` seam |
| `desk/maintenance/` | The maintenance engine: domain-write-bus subscriber, Smart Index updater/rebuild, state refresher |
| `desk/domain-write-bus.ts` + `desk/path-identity.ts` | The ONE maintenance trigger (published from `file-operations.ts`) + path classification |
| `desk/{data-root,editor-notifier,agent-context-writer}.ts` | The injectable host seams (see Monorepo Layout) |

**`@desk/app` (`packages/app/src/`) — UI layer:**

| Directory | Purpose |
|-----------|---------|
| `lib/ai/` | OS-Keychain secrets only — the AI layer itself is core `desk/ai/` (see [README](packages/app/src/lib/ai/README.md)) |
| `lib/context-index/` | Smart Index: AI-summarized file catalog for context retrieval |
| `lib/email/` | `.eml` parsing + email tab data shapes |
| `lib/{file-tree-hooks,cache-invalidator,desk-watcher}.ts` | React/query-coupled file-cache glue |
| `stores/` | TanStack Query hooks + Zustand stores |
| `hooks/` | Reusable React hooks (project lookup, grouping, etc.) |
| `components/patterns/` | Page-level layout patterns |
| `components/tabs/` | Tab bar and content system |
| `components/editors/` | Full-width doc/task/meeting editors |
| `components/` | React components by feature |
| `pages/` | Page components (one per route) |
| `app/` | App shell, providers, globals.css |
| `../src-tauri/` (i.e. `packages/app/src-tauri/`) | Tauri 2 Rust shell (commands, drop overlay, icons, `tauri.conf.json`) |

## Current State: v0.10

> The source of truth for the version is `packages/app/package.json` / `packages/app/src-tauri/tauri.conf.json`. All workspace packages (`core`, `app`, `server`) are versioned in lockstep — the release workflow enforces this. Keep this heading in sync when bumping.

Key features:
- Dashboard with Focus and Workspaces widgets
- **Work Mode**: Workspace selector at bottom, all views filter automatically
- Home workspace (`home: true`) with quick-capture inbox, created at onboarding
- Workspaces with color coding (home workspace defaults to indigo)
- Projects Hub at `/projects`: secondary-sidebar project list + an overview dashboard
  (inline status/description edit, task stats, quick links to Tasks/Docs/Meetings)
- **Project brief + state file**: a seeded, fully-human `context/YYYY-MM-DD-brief.md` per project
  plus an AI-owned `context/YYYY-MM-DD-state.md` ("Current state", `author: ai`), rewritten in the
  background as records change (watcher-triggered, debounced, freshness-gated). The Context panel
  on Project Home shows both and whether the snapshot has drifted. No progress bars anywhere:
  counts have no denominator and cannot lie.
- **Docs**: Tree structure with folders; drag-drop import converts Word/PDF/Excel/CSV/HTML
  to Markdown (mammoth, pdfjs-dist, read-excel-file, papaparse, turndown), targeting the drop folder
- **Smart Index (AI catalog)**: AI-summarized file catalog for context retrieval, maintained by the engine on whichever host owns the data (local: Keychain key; hosted: server env key — web clients get it too); external agents connect over **MCP** (hosted) or the generated `CLAUDE.md`/`AGENTS.md` (local).
- **i18n**: all UI copy via i18next/react-i18next from [packages/app/src/i18n/en.json](packages/app/src/i18n/en.json)
- Cross-platform: macOS, Windows, and Linux (email drag-drop overlay is macOS-only)
- Global search (Cmd+K)
- Manual save with Cmd+S, unsaved changes protection

## Email Integration

**Drag any message onto the Desk window** — works for Apple Mail, Outlook for Mac (Legacy and New Outlook), Thunderbird, and Finder. The dropped message is parsed and opened in a session-only email tab. The tab is a viewer with a **Copy email** button; to draft a reply the user pastes that text into the `draft-email-reply` **MCP prompt** in their AI connector (Claude/ChatGPT) and copies the result back to their mail client.

Two parallel drop paths feed the same import pipeline:

Both drop paths are handled by the native Cocoa `NSView` overlay in [packages/app/src-tauri/src/drop_view.m](packages/app/src-tauri/src/drop_view.m), which sits above the WKWebView and claims every URL-bearing pasteboard:

- **File promises** (Apple Mail, Outlook) — Apple Mail / Outlook drag emails as `NSFilePromiseReceiver` (or the legacy `NSFilesPromisePboardType`), which Tauri's WKWebView drop handler ignores. The overlay accepts the promise, materializes it into `$TMPDIR/desk-drops/`, and emits `email-drag-{enter,leave,drop}` Tauri events. [packages/app/src/components/email/email-drop-overlay.tsx](packages/app/src/components/email/email-drop-overlay.tsx) opens the resulting `.eml` in an email tab.
- **Plain file URLs** (Thunderbird, Finder, anywhere else) — the same overlay extracts the file URLs and emits `desk-files-drag-{enter,leave,over,drop}` (drop payload includes cursor x/y in flipped/DOM coords). [packages/app/src/components/docs/content-drop-zone.tsx](packages/app/src/components/docs/content-drop-zone.tsx) routes these into the docs tree at the cursor row. Direct file URLs no longer reach Tauri's `getCurrentWebview().onDragDropEvent`; the listener in `email-drop-overlay.tsx` is kept as a defensive fallback only.

The Cocoa file carries an inline comment block explaining the Apple Mail 60-second callback hang and the FSEvents workaround that makes drops feel instant for that client. Read [packages/app/src-tauri/src/drop_view.m](packages/app/src-tauri/src/drop_view.m) before touching this code.

Web mail (Gmail, Outlook Web) — out of scope. Workaround: "Show original" → save → drag the resulting `.eml`.

**Email Schema (in-memory):**
```typescript
interface IncomingEmail {
  subject: string;
  from: { name?: string; email: string };
  body: string;
  to?: { name?: string; email: string }[];
  cc?: { name?: string; email: string }[];
  date?: string;  // ISO date
  messageId?: string;
  source: 'outlook' | 'thunderbird' | 'apple-mail' | 'other';
}
```

**Key Files:**
| File | Purpose |
|------|---------|
| `packages/app/src/lib/email/types.ts` | `IncomingEmail` / `EmailTabData` shapes |
| `packages/app/src/lib/email/eml-import.ts` | `.eml` parsing (postal-mime) + Tauri `read_eml_file` invoke |
| `packages/app/src/components/email/email-drop-overlay.tsx` | Listens for both direct-URL and promise drops |
| `packages/app/src/components/email/` | Email viewer and draft reply UI |
| `packages/app/src-tauri/src/drop_view.m` | Cocoa NSView accepting `NSFilePromiseReceiver` drops + FSEvents fallback |
| `packages/app/src-tauri/src/drop_view.rs` | Rust FFI wrapper around the Cocoa overlay |
| `packages/app/src-tauri/src/lib.rs` (`read_eml_file`, `delete_dropped_file`) | File read + temp cleanup |
| `packages/app/src-tauri/build.rs` | Compiles `drop_view.m` on macOS via the `cc` crate |

## AI Context

The Smart Index builds an AI-summarized file catalog per workspace. There is no in-app chat assistant — external agents reach desk over **MCP** (`@desk/server`, read-only tools `desk_workspace_info`/`desk_tree`/`desk_read`/`desk_search`/`desk_catalog`, plus the `draft-email-reply` prompt) in hosted mode, and over generated `CLAUDE.md`/`AGENTS.md` in local mode. There are no Rust `desk_*` commands.

**Read layer routes through `DeskService`, not bare `getStorage()`.** The read queries (`deskTree`/`deskReadFile`/`deskFullTextSearch`/`deskWorkspaceInfo`, promoted to `DeskService`) plus the Smart Index read (`getIndexCache` → `.desk/index/indexes.json`; writes are core-internal via the maintenance engine's `index-store-io`) all go through `getDeskService()`. So in hosted mode they run on the **server** (the catalog lives server-side for MCP), not the client's local disk. The MCP tools on the server read through the same `DeskService`.

**AI maintenance runs where the data lives.** The AI layer (providers, `AIService`, prompts) is
core (`desk/ai/`, key via the `setAIKeyResolver` seam); the maintenance engine (`desk/maintenance/`)
runs in-process on whichever host owns the domain — the app in local mode (Keychain key, consent
dialog), the **server** in hosted mode (env keys; setting one is the operator's consent), so hosted
web clients get the Smart Index too. Provider/model + toggles are USER settings in
`.desk/settings/ai-maintenance.json` (shared with the server engine); usage is appended in-process
by whichever host runs the AI (core `appendAIUsage`) to `.desk/usage/ai-usage.json`, and read back
via `DeskService.getAIUsage` (the Usage panel works in every mode). The generated agent files (`CLAUDE.md`/`AGENTS.md`/`GEMINI.md`/`WORKSPACE_CONTEXT.md`)
are a **local-mode feature** — skipped when `isRemoteMode()`; in hosted mode **MCP** is the
external-agent interface, not generated markdown.

**Key files:**
| Directory | Purpose |
|-----------|---------|
| `packages/app/src/lib/context-index/` | Smart Index: builder, indexer, artifacts, agent context |
| `packages/app/src/lib/context-index/agent-context.ts` | Generates CLAUDE.md + AGENTS.md for external agents |
| `packages/app/src/stores/agent-settings.ts` | Agent-file emit toggles + background-AI settings (Zustand, persisted) |
| `packages/core/src/desk/maintenance/` | Background engine: state refresh + index updates (bus-triggered, debounced) |
| `packages/app/src/stores/context-index.ts` | Smart Index data store |

## UI Patterns

### UI Strings (i18n)

All user-facing strings live in [packages/app/src/i18n/en.json](packages/app/src/i18n/en.json). Never hardcode user-visible copy in JSX, toasts, or thrown errors that bubble to the UI.

```tsx
// React components
import { useTranslation } from "react-i18next";
const { t } = useTranslation();
return <Button>{t("common.buttons.save")}</Button>;

// Non-React code (stores, hooks, libs)
import i18next from "i18next";
toast.success(i18next.t("toasts.workspace.create.success"));
```

Namespace tree (top-level keys in `en.json`): `common`, `nav`, `pages.*`, `settings.*`, `modals.*`, `editors.*`, `entities.*`, `emptyStates`, `toasts`, `errors`, `email`, `search`, `smartIndex`, `setup`, `tooltips`, `menus`. Feature-specific copy goes under `pages.*` or `settings.*`; reusable strings (buttons, status labels) under `common` or `entities.*`. Interpolate with `{{name}}` and use `count` for plurals (i18next handles `_one` / `_other` suffixes automatically).

**Out of scope for translation** — these stay English in source: AI system prompts ([packages/core/src/desk/ai/prompts.ts](packages/core/src/desk/ai/prompts.ts)), MCP tool/prompt descriptions ([packages/server/src/mcp.ts](packages/server/src/mcp.ts)), generated agent files ([packages/app/src/lib/context-index/agent-context.ts](packages/app/src/lib/context-index/agent-context.ts), [packages/app/src/lib/context-index/artifacts.ts](packages/app/src/lib/context-index/artifacts.ts)), `console.*` debug strings, file paths, localStorage keys, frontmatter field names, status enum *values*. The ESLint rule `i18next/no-literal-string` is scoped to `src/components/**` and `src/pages/**` (within `@desk/app`) only — it will flag bare strings; fix them by adding a key to `en.json` and using `t()`.

### Scrolling
Always use `<ScrollArea>` from `@/components/ui/scroll-area` for scrollable content. It uses OverlayScrollbars for consistent styling across platforms (including Tauri/macOS).

**Important**: ScrollArea needs proper height constraints from parent containers to work:
```tsx
// Parent containers need: h-full, overflow-hidden, min-h-0 (for flex)
<div className="flex flex-col h-full overflow-hidden">
  <header>...</header>
  <ScrollArea className="flex-1 min-h-0">
    <div className="p-6">{content}</div>
  </ScrollArea>
</div>
```

### Component Architecture

**Tab-Based Editing (Obsidian-style)**:
- `TabBar` / `TabContent` - Tab system in `packages/app/src/components/tabs/`
- `DocEditor` / `TaskEditor` / `MeetingEditor` - Full-width editors in `packages/app/src/components/editors/`
- "Desk" tab is always pinned, showing current app view
- Clicking docs/tasks/meetings opens them in new tabs
- Tab state persists in localStorage via `useTabStore`
- Keyboard shortcuts: Cmd+W close, Cmd+Shift+[ ] switch tabs

**Core UI Components**:
- `RichTextEditor` - Tiptap WYSIWYG markdown editor
- `DocExplorer` - Doc tree browser with scope dropdown

### Reusable Hooks (`packages/app/src/hooks/`)

Use these hooks instead of duplicating logic:
- `useProjectName(workspaceId)` - Project name lookup by ID
- `useOpenFromQuery(items, onOpen, path)` - Handle `?open=id` URL params
- `useGroupedItems(items, getKey)` - Group items by a key function
- `useEditorTab(tabId, title, isDirty)` - Manage editor tab title/dirty state
- `useEditorSession(options)` - **Editor state with manual save** (Cmd+S)

### File System Integration

Editors use a dual-layer system:
- **Open files**: `useEditorSession` owns state, saves on Cmd+S
- **Closed files**: TanStack Query + FileTreeService cache

**Save behavior:**
- Content saves only on explicit Cmd+S (or clicking save button in header)
- Metadata changes (status, priority, title, etc.) save immediately with body from editor
- Tab shows dirty indicator when unsaved
- Closing dirty tab shows Save/Don't Save/Cancel dialog
- Quitting app with dirty tabs shows confirmation dialog

Key stores: `open-editor-registry.ts`, `editor-event-bus.ts`

### Where state lives (the storage model)

Decide by **scope**; the home follows mechanically. The key rule once hosted mode exists:
**"it's a file" ≠ "it syncs" — only `DeskService`-backed paths reach the server.** So anything
that should follow the user across devices must go through `getDeskService()`, not a bare
`getStorage()` / `localStorage`.

| Scope | Meaning | Home | Syncs in hosted? |
|-------|---------|------|------------------|
| **USER** | follows the person across devices | a file in the data tree via **`DeskService`** (markdown or `.desk/*.json`) | ✅ yes |
| **DEVICE** | this machine / window / session | `localStorage` · Rust OS-config · Keychain (secrets) | no (correct) |
| **DERIVED** | rebuildable cache | `.desk/*` local (server-side later) | n/a |
| **AUTH/SESSION** | identity, server-side | **SQLite** (`@desk/server`) | server-only |

Headline: *Follows you → `DeskService`-backed file. About this device → localStorage. Secrets →
Keychain. Auth → SQLite. Caches → `.desk/`.* Do **not** put user settings in SQLite — files keep
"own your files" and get sync free through the seam.

**Remote mode makes local disk off-limits, structurally.** When the domain runs on a server
(native app pointed at a server, or the hosted web build), `main.tsx` installs a
`GuardStorageProvider` so every `getStorage()` call **throws** — domain data must go through
`getDeskService()` (the RPC client). The one predicate that gates legitimate local-disk access is
**`isLocalDisk()` = `isTauri() && !isDomainRemote()`** ([connection.ts](packages/app/src/lib/connection.ts));
never branch storage decisions on bare `isTauri()` (that misses the native-remote case). Local-file
needs that survive in remote (dropped-file / `.eml` staging) use dedicated Tauri commands, not the
`StorageProvider` seam.

**Directory Structure:**
```
~/DeskMD/
├── .desk/                    ← App metadata
│   ├── settings/             ← USER settings, shared via DeskService (getSetting/setSetting)
│   │   ├── templates.json
│   │   ├── agent-instructions.json
│   │   └── planner.json
│   ├── index/indexes.json    ← Smart Index (DERIVED cache, local)
│   └── usage/ai-usage.json   ← AI usage records (DERIVED/telemetry, local)
└── workspaces/
    └── {workspaceId}/
        ├── .aiignore         ← Per-workspace AI exclusions (.gitignore syntax)
        ├── .view.json        ← View state — USER, shared via DeskService (getViewState/…)
        ├── context/          ← The map (evergreen, maintained, co-authored)
        ├── docs/             ← Records (dated, accumulate)
        └── projects/{id}/
            ├── context/      ← The map, per project
            └── docs/, tasks/, meetings/   ← Records
```

**Classification (current):**
| State | Scope | Home | Reached via |
|-------|-------|------|-------------|
| Tasks / docs / meetings / projects / workspaces | USER | markdown files | `getDeskService()` |
| View state (`.view.json`: task order, view mode, expanded folders, highlights, hidden statuses) | USER | `.view.json` | `getDeskService().getViewState/…` |
| Templates, agent-instructions, week planner, **AI maintenance settings** (provider/model + auto-summarize/auto-refresh toggles) | USER | `.desk/settings/*.json` (plain JSON — the zustand persist envelope is contained in `createRemoteSettingStorage`) | `getDeskService().getSetting/setSetting` |
| Smart/context index | DERIVED | `.desk/index/indexes.json` (plain `{indexes}`) | **core is the sole writer** (maintenance engine + local rebuild via `writeWorkspaceIndex`); the app reads only, through a TanStack query over `getIndexCache` (`useSmartIndex`) |
| AI usage log | DERIVED (telemetry) | `.desk/usage/ai-usage.json` | core `appendAIUsage` (in-process write) + `getDeskService().getAIUsage` (read) |
| Preferences (theme, language, sidebar widths, workday hours, dismissedUpdate) | DEVICE | localStorage `desk-preferences` | zustand persist |
| Navigation (current workspace), tabs | DEVICE | localStorage | zustand persist |
| Boot (dataPath, setupCompleted, connectionMode, serverUrl) | DEVICE | localStorage `desk-boot` + Rust `config.json` | boot store / Rust |
| AI key presence + consent | DEVICE | localStorage `desk-ai-settings-v2` | zustand persist |
| AI keys, remote session token | DEVICE | OS Keychain | `secret_*` Tauri commands |
| Auth (users, sessions) | AUTH | SQLite (hosted only) | Better Auth |

> The `agent-settings.ts` emit-flags stay DEVICE deliberately: generated agent files only exist
> on a local disk, so the toggles are per-machine by nature.

**Rules:**
- A new **user-level** setting → a `.desk/settings/<key>.json` via `createRemoteSettingStorage(key)`
  (app store) which routes through `DeskService.getSetting/setSetting`. Never bare `localStorage`.
- A new **device-level** UI preference → `localStorage` (plain zustand persist). Never a file.
- A **derived cache** → a file under `.desk/` written by core (the Smart Index via
  `index-store-io`; the app reads it through `DeskService.getIndexCache` / `useSmartIndex`);
  do not sync large caches over RPC.
- **Format**: JSON for structured data, plain text for lists (`.aiignore`).

**No Backwards Compatibility:** Single user, no migration code. Moving a setting's home just
abandons the old location and re-creates it empty.

### Form Components

For modal forms, use these instead of raw `<div className="space-y-2"><Label>`:
```tsx
import { FormField } from "@/components/ui/form-field";
import { FormGrid } from "@/components/ui/form-grid";

<FormField id="name" label="Name" optional>
  <Input id="name" ... />
</FormField>

<FormGrid columns={2}>
  <FormField label="Date">...</FormField>
  <FormField label="Priority">...</FormField>
</FormGrid>
```

### Page Patterns (`packages/app/src/components/patterns/`)

- `FilteredListPage` - Standard layout for pages with Header + FilterBar + ScrollArea + Modal

## App Icon

Source icon: `icon.png` (1024x1024, square with full bleed background)

**Regenerating icons:**

```bash
# 1. Generate all Tauri icons (Windows, iOS, Android)
npx @tauri-apps/cli icon icon.png

# 2. Generate macOS icon with Big Sur squircle mask
~/.local/bin/appicongen --macos --bigsurify -o macos-icon.iconset icon.png

# 3. Fix iconset filenames for iconutil (appicongen uses wrong names)
cd macos-icon.iconset
cp icon_16x16@2x.png icon_32x32.png
cp icon_128x128@2x.png icon_256x256.png
cp icon_256x256@2x.png icon_512x512.png

# 4. Convert to icns and replace
iconutil -c icns macos-icon.iconset -o macos-icon.icns
mv macos-icon.icns packages/app/src-tauri/icons/icon.icns
rm -rf macos-icon.iconset
```

> The Tauri project now lives in `packages/app/src-tauri`. `npx @tauri-apps/cli icon`
> writes to `<cwd>/src-tauri/icons`, so run the icon commands from `packages/app`
> (or move the generated `icons/` into `packages/app/src-tauri/`).

> **Why two steps?** macOS doesn't auto-apply rounded corners to native apps (unlike iOS). The square source works for Windows/iOS/Android, but macOS needs the squircle baked in.

**Install appicongen (first time only):**
```bash
brew install pipx
pipx install appicongen
```

## Dev Notes

- Dashboard at `/`, All Tasks at `/tasks`
- Projects Hub at `/projects` — a single route; the project is selected via the
  secondary sidebar (`useProjectSelectionStore`) and its overview dashboard renders
  in the Desk tab. No `/projects/:id` route.
- Mock data used when `isTauri() === false`
- `_unassigned` is a special directory for items without a project
- The **home workspace** is an ordinary workspace folder marked `home: true` in its `workspace.md`; resolve its id via `getHomeWorkspaceId()` (cached). It holds the capture inbox, is undeletable, and sorts first.
- `_capture` is the triage inbox, a special directory inside the home workspace
- **Single user**: No migration code or backward compatibility needed
- All path strings must use `PATH_SEGMENTS.*` and `SPECIAL_DIRS.*` from `constants.ts`

## External AI Agent Support

Desk generates `CLAUDE.md` and `AGENTS.md` files automatically so external AI agents (Claude CLI, Codex, etc.) can understand and work with Desk data without any special tooling.

**Generated files:**
- `~/Desk/CLAUDE.md` — Top-level: lists all workspaces, explains directory structure, frontmatter schemas, how to create/edit items
- `~/Desk/workspaces/{id}/CLAUDE.md` — Per-workspace: workspace info, project listing, pointer to catalog
- `~/Desk/workspaces/{id}/WORKSPACE_CONTEXT.md` — AI-generated file catalog with summaries (from Smart Index)

**Regeneration triggers:** workspace create/update/delete, project create/update/delete, index rebuild, app startup.

**Key files:**
- `packages/app/src/lib/context-index/agent-context.ts` — Generates CLAUDE.md + AGENTS.md content
- `packages/app/src/lib/context-index/artifacts.ts` — Generates WORKSPACE_CONTEXT.md

## CI/CD & Releases

**Workflow**: `.github/workflows/release.yml` — triggers on `v*` tag push, builds the macOS app (`tauri-action` with `projectPath: packages/app`; Rust cache scoped to `packages/app/src-tauri`), and publishes a GitHub Release on `v1lling/desk.md` itself (built-in `GITHUB_TOKEN`, no PAT). A pre-build step asserts the tag matches the version in all workspace packages.

**Versioning (Semantic Versioning)**:
- **MAJOR (x.0.0)**: Breaking changes, major architecture shifts
- **MINOR (0.x.0)**: New features, significant functionality additions
- **PATCH (0.0.x)**: Bug fixes, UI polish, performance tweaks, dependency updates

Examples:
- New tab system, email integration → MINOR
- Removed label, improved styling → PATCH
- Fixed crash, performance optimization → PATCH

**Release steps**:
```bash
# 1. Bump version in all four (kept in lockstep; release.yml enforces it)
# packages/app/src-tauri/tauri.conf.json → "version": "X.Y.Z"
# packages/app/package.json              → "version": "X.Y.Z"
# packages/core/package.json             → "version": "X.Y.Z"
# packages/server/package.json           → "version": "X.Y.Z"
# 2. Commit, tag, push
git add packages/app/src-tauri/tauri.conf.json packages/app/package.json \
        packages/core/package.json packages/server/package.json
git commit -m "vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
# 3. CI builds (~7 min) → publishes a GitHub Release (.dmg + updater) on v1lling/desk.md
# 4. Running app detects update on next launch (once the repo is public)
```

**Auto-updater**: App checks `desk.md/releases/latest/download/latest.json` on launch. Settings > General has a manual check button. Signing key pair required (see GitHub Secrets). Note: while the repo is private the endpoint 404s (private release assets need auth), so interim installs are manual — the updater resumes automatically once the repo goes public.

**GitHub CLI**: Use `gh` for issues, PRs, releases (authenticated, see `~/CLAUDE.md`).

**GitHub Secrets** (on `v1lling/desk.md`):
- `TAURI_SIGNING_PRIVATE_KEY` — Tauri signing private key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — its password

## Headless / Automated Runs

When running headless (via `claude-auto` or any non-interactive pipeline):

- **Never deploy** — only create branches and PRs to `main`
- **Always build** — run `npm run build` before committing to verify nothing is broken
- **Always create PRs** — never push directly to `main`
- **Commit as v1lling only** — `v1lling <sascha.villing@web.de>`, no Co-Authored-By lines
- **One issue per run** — keep changes focused and reviewable
