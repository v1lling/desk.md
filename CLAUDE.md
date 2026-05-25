# desk.md - Local-First Work Management

> Desktop app to manage workspaces, projects, tasks, docs, and meetings — all as local Markdown files you own.

## Quick Start

```bash
npm run dev          # Browser with mock data (port 3001)
npm run tauri:dev    # Desktop with real file system
npm run tauri:build  # Production build
```

## Core Concept

```
Workspace (any area of work — a client, side project, or life area)
├── Workspace-level Docs
├── _unassigned/          (tasks without a project)
├── _capture/             (home workspace only - triage inbox)
└── Projects
    └── Project
        ├── Tasks, Docs, Meetings

The home workspace (frontmatter `home: true`) holds the capture inbox and is always first in the list.
```

**"Work Mode" Navigation**: User selects active workspace via bottom selector. All views (Tasks, Docs, Meetings) filter to that workspace automatically.

## Tech Stack

- **Frontend**: Vite, React 19, React Router, TypeScript, Tailwind CSS, shadcn/ui
- **Desktop**: Tauri 2 (Rust shell)
- **State**: TanStack Query (server), Zustand (client)
- **Editor**: Tiptap (WYSIWYG markdown)
- **Drag & Drop**: @dnd-kit

> **Note**: This is a single-page app (SPA) built with Vite. No SSR, no API routes — Tauri bundles static files only. The "backend" is Tauri's Rust layer for file system access. If a real backend is ever needed (sync, auth), it would be a separate service.

## Data Models

```typescript
type TaskStatus = 'todo' | 'doing' | 'waiting' | 'done';
type TaskPriority = 'low' | 'medium' | 'high';
type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';
type ContentScope = 'personal' | 'workspace' | 'project';
```

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/lib/desk/` | Core CRUD operations |
| `src/lib/desk/file-cache/` | File tree cache for list views (LRU cache) |
| `src/lib/ai/` | AI integration (see [README](src/lib/ai/README.md)) |
| `src/lib/context-index/` | Smart Index: AI-summarized file catalog for context retrieval |
| `src/lib/assistant/` | Multi-turn agent orchestrator with read-only tools (browse/search/read) |
| `src/stores/` | TanStack Query hooks + Zustand stores |
| `src/hooks/` | Reusable React hooks (project lookup, grouping, etc.) |
| `src/components/patterns/` | Page-level layout patterns |
| `src/components/tabs/` | Tab bar and content system |
| `src/components/editors/` | Full-width doc/task/meeting editors |
| `src/components/` | React components by feature |
| `src/pages/` | Page components (one per route) |
| `src/app/` | App shell, providers, globals.css |

## Current State: v0.7

Key features:
- Dashboard with Focus and Workspaces widgets
- **Work Mode**: Workspace selector at bottom, all views filter automatically
- Home workspace (`home: true`) with quick-capture inbox, created at onboarding
- Workspaces with color coding (home workspace defaults to indigo)
- Projects Hub at `/projects`: secondary-sidebar project list + an overview dashboard
  (inline status/description edit, task stats, quick links to Tasks/Docs/Meetings)
- **Docs**: Tree structure with folders, drag-drop import
- **AI Chat**: Claude Code CLI or Anthropic API, with context retrieval (Smart Index)
- Global search (Cmd+K)
- Manual save with Cmd+S, unsaved changes protection

## Email Integration

**Drag any message onto the Desk window** — works for Apple Mail, Outlook for Mac (Legacy and New Outlook), Thunderbird, and Finder. The dropped message is parsed and opened in a session-only email tab; the user runs "Draft Reply → Open Draft in Assistant" and copies the reply back to their mail client.

Two parallel drop paths feed the same import pipeline:

- **Direct file URLs** (Thunderbird, Finder) — handled by Tauri's built-in `onDragDropEvent` in [src/components/email/email-drop-overlay.tsx](src/components/email/email-drop-overlay.tsx).
- **File promises** (Apple Mail, Outlook) — handled by a native Cocoa `NSView` overlay in [src-tauri/src/drop_view.m](src-tauri/src/drop_view.m). Apple Mail / Outlook drag emails as `NSFilePromiseReceiver`, which Tauri's WKWebView drop handler ignores. The overlay accepts the promise, materializes it into `$TMPDIR/desk-drops/`, and emits `email-drag-{enter,leave,drop}` Tauri events.

The Cocoa file carries an inline comment block explaining the Apple Mail 60-second callback hang and the FSEvents workaround that makes drops feel instant for that client. Read [src-tauri/src/drop_view.m](src-tauri/src/drop_view.m) before touching this code.

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
| `src/lib/email/types.ts` | `IncomingEmail` / `EmailTabData` shapes |
| `src/lib/email/eml-import.ts` | `.eml` parsing (postal-mime) + Tauri `read_eml_file` invoke |
| `src/components/email/email-drop-overlay.tsx` | Listens for both direct-URL and promise drops |
| `src/components/email/` | Email viewer and draft reply UI |
| `src-tauri/src/drop_view.m` | Cocoa NSView accepting `NSFilePromiseReceiver` drops + FSEvents fallback |
| `src-tauri/src/drop_view.rs` | Rust FFI wrapper around the Cocoa overlay |
| `src-tauri/src/lib.rs` (`read_eml_file`, `delete_dropped_file`) | File read + temp cleanup |
| `src-tauri/build.rs` | Compiles `drop_view.m` on macOS via the `cc` crate |

## AI Context

The Smart Index builds an AI-summarized file catalog per workspace. The in-app assistant uses tool-driven retrieval (desk_catalog, desk_read). External agents use the generated `CLAUDE.md` and `WORKSPACE_CONTEXT.md` files.

**Key files:**
| Directory | Purpose |
|-----------|---------|
| `src/lib/context-index/` | Smart Index: builder, indexer, artifacts, agent context |
| `src/lib/context-index/agent-context.ts` | Generates CLAUDE.md + AGENTS.md for external agents |
| `src/stores/context.ts` | Context settings (Zustand, persisted) |
| `src/stores/context-index.ts` | Smart Index data store |

## UI Patterns

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
- `TabBar` / `TabContent` - Tab system in `src/components/tabs/`
- `DocEditor` / `TaskEditor` / `MeetingEditor` - Full-width editors in `src/components/editors/`
- "Desk" tab is always pinned, showing current app view
- Clicking docs/tasks/meetings opens them in new tabs
- Tab state persists in localStorage via `useTabStore`
- Keyboard shortcuts: Cmd+W close, Cmd+Shift+[ ] switch tabs

**Core UI Components**:
- `RichTextEditor` - Tiptap WYSIWYG markdown editor
- `AIChatEditor` - AI Chat tab (⌘⇧A to open)
- `DocExplorer` - Doc tree browser with scope dropdown

### Reusable Hooks (`src/hooks/`)

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

### Metadata File Conventions

All app metadata lives in `~/Desk/.desk/` for organization and consistency:

**Directory Structure:**
```
~/Desk/
├── .desk/                   ← All app metadata
│   ├── index/
│   │   └── indexes.json     ← Smart Index (all workspaces in one file)
│   ├── usage/
│   │   └── ai-usage.json   ← AI usage records (90-day rolling)
│   └── planner/
│       └── weeks.json      ← Week planner data
└── workspaces/
    └── {workspaceId}/
        ├── .aiignore        ← Per-workspace AI exclusions (.gitignore syntax)
        └── .view.json       ← Per-workspace view state (UI preferences)
```

**Rules:**
- **App-level metadata** → `.desk/` subdirectories (indexes, usage, planner)
- **Workspace-specific config** → Root of workspace directory (`.aiignore`, `.view.json`)
- **User content** → Regular `.md` files with YAML frontmatter
- **Naming**: Use `.desk/` for app metadata, dot-prefix (`.aiignore`) for hidden config
- **Format**: JSON for structured data, plain text for lists/exclusions

**Storage Strategy:**
| Data Type | Storage | Reason |
|-----------|---------|--------|
| User Content | Filesystem | Must backup, sync, persist |
| Derived Indexes | Filesystem (`.desk/`) | Expensive to rebuild, should sync |
| Growing Data | Filesystem (`.desk/`) | AI usage, planner — too large for localStorage |
| Boot Config | localStorage (`desk-boot`) | Sync read at startup, duplicated to Rust config |
| User Preferences | localStorage (`desk-preferences`) | Sync read, reactive UI |
| Navigation State | localStorage (`desk-navigation`) | Current workspace selection |
| AI Settings | localStorage (`desk-ai-settings-v2`) | Provider config, custom instructions |
| Session State | localStorage (`desk-tabs`, `desk-assistant`) | UI-only, OK to lose |
| Rust Boot Config | OS config dir (`config.json`) | Rust needs `data_path` before WebView |
| Secrets | OS Keychain | API keys (macOS) |
| View Preferences | Filesystem (`.view.json`) | Per-workspace/project UI state |

**No Backwards Compatibility:** Single user, no migration code needed. Just delete and rebuild.

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

### Page Patterns (`src/components/patterns/`)

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
mv macos-icon.icns src-tauri/icons/icon.icns
rm -rf macos-icon.iconset
```

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
- `src/lib/context-index/agent-context.ts` — Generates CLAUDE.md + AGENTS.md content
- `src/lib/context-index/artifacts.ts` — Generates WORKSPACE_CONTEXT.md

## CI/CD & Releases

**Workflow**: `.github/workflows/release.yml` — triggers on `v*` tag push, builds the macOS app, and publishes a GitHub Release on `v1lling/desk.md` itself (built-in `GITHUB_TOKEN`, no PAT).

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
# 1. Bump version in both files
# tauri.conf.json → "version": "X.Y.Z"
# package.json → "version": "X.Y.Z"
# 2. Commit, tag, push
git add src-tauri/tauri.conf.json package.json
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
