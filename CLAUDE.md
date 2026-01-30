# desk.md - Project-Centric Work Management

> Desktop app for freelancers to manage projects, tasks, and docs across multiple clients.

## Quick Start

```bash
npm run dev        # Browser with mock data (port 3001)
npm run tauri dev  # Desktop with real file system
```

## Core Concept

```
Personal Space (private, no workspace)
├── Capture, Tasks, Docs

Workspace (Client/Context)
├── Workspace-level Docs
└── Projects
    └── Project
        ├── Tasks, Docs, Meetings
```

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
- Personal Space (capture, tasks, docs)
- Workspaces with color coding
- Projects inline in sidebar (alphabetically sorted)
- Project detail with Tasks, Docs, Meetings tabs
- **Docs**: Tree structure with folders, drag-drop import
- **AI Chat**: Claude Code CLI or Anthropic API, with doc context
- Global search (Cmd+K)
- Auto-save with file watcher

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
| `outlook-addin/` | Outlook Add-in source (separate project) |

**Testing deep links (requires built .app in /Applications):**
```bash
# Test email: {"subject":"Test","from":{"email":"test@example.com"},"body":"Hello","source":"other"}
open "desk://email?data=eyJzdWJqZWN0IjoiVGVzdCIsImZyb20iOnsiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0sImJvZHkiOiJIZWxsbyIsInNvdXJjZSI6Im90aGVyIn0="
```

**Flow:** Email opens in session-only tab → user links to project → AI drafts reply → opens mailto:

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
- `SlidePanel` - Slide-in panel (used by AI chat)
- `DocExplorer` - Doc tree browser with scope dropdown

### Reusable Hooks (`src/hooks/`)

Use these hooks instead of duplicating logic:
- `useProjectName(workspaceId)` - Project name lookup by ID
- `useOpenFromQuery(items, onOpen, path)` - Handle `?open=id` URL params
- `useGroupedItems(items, getKey)` - Group items by a key function
- `useEditorTab(tabId, title, isDirty)` - Manage editor tab title/dirty state
- `useEditorSession(options)` - **Editor state with auto-save** (see Architecture doc)

### File System Integration

Editors use a dual-layer system to avoid cursor loss/flickering:
- **Open files**: `useEditorSession` owns state, auto-saves with 400ms debounce
- **Closed files**: TanStack Query + FileTreeService cache

Key stores: `open-editor-registry.ts`, `editor-event-bus.ts`

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) → "File System Integration" for full details.

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

## Dev Notes

- Dashboard at `/`, All Tasks at `/tasks`
- No dedicated `/projects` page - projects listed inline in sidebar
- Project detail at `/projects/view?id=xxx` (query params due to static export)
- Mock data used when `isTauri() === false`
- `_unassigned` is a special directory for items without a project
- **Single user**: No migration code or backward compatibility needed
- All path strings must use `PATH_SEGMENTS.*` from `constants.ts`
