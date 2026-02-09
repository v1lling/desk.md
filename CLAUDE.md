# desk.md - Work Management for Freelancers

> Desktop app to manage workspaces, projects, tasks, and docs across multiple clients.

## Quick Start

```bash
npm run dev          # Browser with mock data (port 3001)
npm run tauri:dev    # Desktop with real file system + MCP plugin
npm run tauri:build  # Production build (no MCP)
```

## Core Concept

```
Workspace (Client or Personal)
├── Workspace-level Docs
├── _unassigned/          (tasks without a project)
├── _capture/             (Personal only - triage inbox)
└── Projects
    └── Project
        ├── Tasks, Docs, Meetings

Personal = workspace "_personal" (always first in list)
```

**"Work Mode" Navigation**: User selects active workspace via bottom selector. All views (Tasks, Docs, Meetings) filter to that workspace automatically.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed structure, file paths, and design decisions.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Desktop**: Tauri 2 (Rust shell)
- **State**: TanStack Query (server), Zustand (client)
- **Editor**: Tiptap (WYSIWYG markdown)
- **Drag & Drop**: @dnd-kit

> **Note**: Next.js is used with `output: "export"` (static HTML/JS/CSS). No SSR, no API routes, no server components - Tauri bundles static files only. The "backend" is Tauri's Rust layer for file system access. If a real backend is ever needed (sync, auth), it would be a separate service.

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
| `src/stores/` | TanStack Query hooks + Zustand stores |
| `src/hooks/` | Reusable React hooks (project lookup, grouping, etc.) |
| `src/components/patterns/` | Page-level layout patterns |
| `src/components/tabs/` | Tab bar and content system |
| `src/components/editors/` | Full-width doc/task/meeting editors |
| `src/components/` | React components by feature |
| `src/app/` | Next.js routes |

## Current State: v0.4

See [docs/FEATURES.md](docs/FEATURES.md) for full feature list.

Key features:
- Dashboard with Focus and Workspaces widgets
- **Work Mode**: Workspace selector at bottom, all views filter automatically
- Personal as workspace (`_personal`) with capture inbox
- Workspaces with color coding (Personal = indigo)
- Projects inline in sidebar (alphabetically sorted)
- Project detail with Tasks, Docs, Meetings tabs
- **Docs**: Tree structure with folders, drag-drop import
- **AI Chat**: Claude Code CLI or Anthropic API, with doc context
- Global search (Cmd+K)
- Manual save with Cmd+S, unsaved changes protection

## Email Integration (Deep Links)

External mail clients can send emails to Desk via deep links for AI-assisted workflows.

**Protocol:** `desk://email?data={base64_encoded_json}`

**Email Schema:**
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
| Directory | Purpose |
|-----------|---------|
| `src/lib/email/` | Email types and deep link parser |
| `src/components/email/` | Email viewer and draft reply UI |
| `src/hooks/use-deep-link.ts` | Deep link initialization |
| `outlook-addin/` | Outlook Add-in source |

### Outlook Add-in Deployment

The add-in files live in `outlook-addin/` but are deployed to a **separate public repo** for GitHub Pages hosting (this repo is private).

**After modifying `outlook-addin/` files, deploy with:**
```bash
git subtree push --prefix=outlook-addin outlook-public main
```

This pushes only the `outlook-addin/` folder to `github.com/v1lling/deskmd-outlook-addin`, which serves the files via GitHub Pages.

**Remotes:**
- `outlook-public` → `git@github.com:v1lling/deskmd-outlook-addin.git` (for subtree push)

**Testing deep links (requires built .app in /Applications):**
```bash
# Test email: {"subject":"Test","from":{"email":"test@example.com"},"body":"Hello","source":"other"}
open "desk://email?data=eyJzdWJqZWN0IjoiVGVzdCIsImZyb20iOnsiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0sImJvZHkiOiJIZWxsbyIsInNvdXJjZSI6Im90aGVyIn0="
```

**Flow:** Email opens in session-only tab → user links to project → AI drafts reply → copy to clipboard → return to Outlook → "Insert Reply from Desk" button opens threaded reply form

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

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) → "File System Integration" for full details.

### Metadata File Conventions

All app metadata lives in `~/DeskMD/.desk/` for organization and consistency:

**Directory Structure:**
```
~/DeskMD/
├── .desk/                   ← All app metadata
│   ├── index/
│   │   └── indexes.json     ← Smart Index (all workspaces in one file)
│   └── rag/
│       └── vectors.db       ← RAG vector database (SQLite)
└── workspaces/
    └── {workspaceId}/
        ├── .aiignore        ← Per-workspace AI exclusions (.gitignore syntax)
        └── .view.json       ← Per-workspace view state (UI preferences)
```

**Rules:**
- **App-level metadata** → `.desk/` subdirectories (indexes, databases)
- **Workspace-specific config** → Root of workspace directory (`.aiignore`, `.view.json`)
- **User content** → Regular `.md` files with YAML frontmatter
- **Naming**: Use `.desk/` for app metadata, dot-prefix (`.aiignore`) for hidden config
- **Format**: JSON for structured data, plain text for lists/exclusions

**Storage Strategy:**
| Data Type | Storage | Reason |
|-----------|---------|--------|
| User Content | Filesystem | Must backup, sync, persist |
| Derived Indexes | Filesystem (`.desk/`) | Expensive to rebuild, should sync |
| App Settings | localStorage | Small, app-specific, no sync needed |
| Secrets | **TODO: Keychain** | Security (currently localStorage, needs encryption) |
| Session State | localStorage | UI-only, OK to lose |
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
- No dedicated `/projects` page - projects listed inline in sidebar
- Project detail at `/projects/view?id=xxx` (query params due to static export)
- Mock data used when `isTauri() === false`
- `_unassigned` is a special directory for items without a project
- `_personal` is the Personal workspace (treated like any other workspace)
- `_capture` is the triage inbox within Personal workspace
- **Single user**: No migration code or backward compatibility needed
- All path strings must use `PATH_SEGMENTS.*` and `SPECIAL_DIRS.*` from `constants.ts`

## MCP Plugin

The `tauri-plugin-mcp` dependency uses a **local path** outside the repo. To make CI work, a no-op stub is committed at `tauri-plugin-mcp/`. It's behind a Cargo feature flag:

- **`npm run tauri:dev`** → passes `--features mcp` → MCP enabled (stub or real plugin)
- **`npm run tauri:build`** / CI → no `--features mcp` → MCP skipped, stub just satisfies Cargo resolution

**For full MCP locally**, replace the stub with a symlink to the real plugin:
```bash
rm -rf tauri-plugin-mcp
ln -s /Users/sascha/Development/tauri-plugin-mcp tauri-plugin-mcp
```

Key files: `src-tauri/Cargo.toml` (`[features]`), `src-tauri/src/lib.rs` (`#[cfg(feature = "mcp")]`)

## CI/CD & Releases

**Workflow**: `.github/workflows/release.yml` — triggers on `v*` tag push, builds macOS app, uploads to public repo `v1lling/deskmd-releases`.

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
# 3. CI builds (~7 min) → uploads .dmg + updater to deskmd-releases
# 4. Running app detects update on next launch
```

**Auto-updater**: App checks `deskmd-releases/releases/latest/download/latest.json` on launch. Settings > General has manual check button. Signing key pair required (see GitHub Secrets).

**GitHub Secrets** (on `v1lling/desk.md`):
- `TAURI_SIGNING_PRIVATE_KEY` — Tauri signing private key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — its password
- `RELEASES_TOKEN` — PAT scoped to `deskmd-releases` with Contents: write
