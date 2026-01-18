# Orbit - Project-Centric Work Management

> A desktop app for freelancers and consultants to manage projects, tasks, notes, and AI-assisted workflows across multiple clients.

## Vision

**Orbit** is a project management tool built around one core idea: **everything lives under projects, projects live under areas.**

Unlike note-taking apps (Obsidian, Notion) where you bend files into project management, Orbit is purpose-built for managing work across multiple clients/contexts while keeping everything in portable markdown files.

### Core Hierarchy

```
Area (Client/Workspace)
  └── Project
        ├── Tasks
        ├── Notes
        └── Context (AI knowledge)
```

### Key Principles

1. **Areas are hard boundaries** - Different clients, different email configs, different worlds
2. **Projects are the atomic unit** - Not notes, not tasks. Projects contain everything.
3. **Markdown everywhere** - Portable, grep-able, future-proof
4. **AI-native** - Context per project enables smart assistance
5. **Offline-first** - Local files, works without internet

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React, TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Desktop | Tauri (Rust shell, ~15MB binary) |
| State | Zustand |
| Data Fetching | TanStack Query |
| Markdown | gray-matter + remark |
| Drag & Drop | @dnd-kit/core |
| AI | Claude CLI subprocess |
| Email (future) | Microsoft Graph / IMAP |

## File Structure

```
~/Orbit/
├── areas/
│   ├── slsp/
│   │   ├── area.md                 # Area metadata & config
│   │   ├── projects/
│   │   │   ├── slskey/
│   │   │   │   ├── project.md      # Project metadata & description
│   │   │   │   ├── tasks/
│   │   │   │   │   └── *.md        # Task files
│   │   │   │   ├── notes/
│   │   │   │   │   └── *.md        # Meeting notes, logs
│   │   │   │   └── context/
│   │   │   │       ├── CLAUDE.md   # AI context for this project
│   │   │   │       └── *.md        # Knowledge files
│   │   │   └── another-project/
│   │   └── _inbox/
│   │       └── tasks/              # Unassigned tasks for this area
│   │
│   └── sss/
│       ├── area.md
│       └── projects/
│           └── main/
│
└── config.json                     # App settings
```

## Key Directories

```
orbit/
├── src/app/              # Next.js App Router pages
├── src/components/       # React components
├── src/lib/              # Core libraries (file parsing, AI)
├── src/stores/           # Zustand state stores
├── src-tauri/            # Tauri Rust backend
└── docs/                 # Project documentation
```

## User Context

The developer (Sascha) is a freelance software developer working for multiple clients:

- **SLSP** (Swiss Library Service Platform) - Many projects, uses Microsoft 365 for email
- **SSS** - Single project, uses IONOS webmail (IMAP/SMTP)

Current workflow uses Obsidian with Bases plugin as a workaround for project management. Orbit replaces this with a purpose-built tool.

## Data Models

### Area
```typescript
interface Area {
  id: string;           // Folder name
  name: string;         // Display name
  description?: string;
  color?: string;       // For UI distinction
  email?: {             // Future: email config
    provider: 'microsoft365' | 'imap';
    // ...provider-specific config
  };
}
```

### Project
```typescript
interface Project {
  id: string;           // Folder name
  areaId: string;       // Parent area
  name: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  description?: string;
  created: string;      // ISO date
}
```

### Task
```typescript
interface Task {
  id: string;           // Filename without .md
  projectId: string;
  areaId: string;
  title: string;
  status: 'todo' | 'doing' | 'done';
  priority?: 'low' | 'medium' | 'high';
  due?: string;         // ISO date
  created: string;
  content: string;      // Markdown body
}
```

### Note
```typescript
interface Note {
  id: string;           // Filename without .md
  projectId: string;
  areaId: string;
  title: string;
  created: string;
  content: string;
}
```

## Development Commands

```bash
# Install dependencies
npm install

# Run dev server (web)
npm run dev

# Run Tauri dev (desktop)
npm run tauri dev

# Build for production
npm run tauri build
```

## Progress Tracking

**IMPORTANT FOR CLAUDE: You MUST update this section after completing each step. This is the single source of truth for project status.**

### Current Status: v0.1 Release Ready

| Phase | Status | Summary |
|-------|--------|---------|
| 1. Foundation | **COMPLETE** | App shell, areas, settings, setup wizard |
| 2. Tasks & Kanban | **COMPLETE** | Kanban board with drag-drop, task CRUD |
| 3. Projects | **COMPLETE** | Project list, project pages, task filtering |
| 4. Notes | **COMPLETE** | Note list, editor with markdown preview |
| 4.5. Structure | **COMPLETE** | Project hub with tabs, notes filtering |
| 5. Polish & Settings | **COMPLETE** | Settings page, theme toggle, toast notifications |
| 6. Tauri Integration | **COMPLETE** | Real file system via Tauri, dual-mode operation |

### v0.1 Features
- **Areas**: Create, switch between areas (clients/workspaces) with color coding
- **Projects**: Create projects within areas, track status (active/paused/completed/archived)
- **Tasks**: Kanban board with drag-drop, task detail panel, quick add
- **Notes**: Markdown editor with live preview, organized by project
- **Settings**: Theme toggle (Light/Dark/System)
- **File System**: All data stored as portable markdown files in `~/Orbit/`
- **Dual-mode operation**:
  - `npm run dev` - Browser with mock data (for UI development)
  - `npm run tauri dev` - Desktop app with real file system

### Architecture Highlights
- **State Management**: TanStack Query for server state, Zustand for app settings
- **File Format**: YAML frontmatter + Markdown body (compatible with Obsidian)
- **Type Safety**: Strict TypeScript throughout
- **Component Library**: shadcn/ui (Radix primitives + Tailwind)

### What's Next (Future Phases)
- Inbox page for unassigned tasks
- Global search / command palette (Cmd+K)
- Keyboard shortcuts
- AI context integration (project-level CLAUDE.md files)
- Email integration (Microsoft 365, IMAP)

### Development Notes
- Routes use query params for dynamic pages (`/projects/view?id=xxx`) due to `output: export`
- Mock data in `lib/orbit/*.ts` files - only used when `isTauri() === false`
- Tauri MCP plugin available for debugging (socket at `/tmp/orbit-mcp.sock`)
- If socket error on startup: `rm -f /tmp/orbit-mcp.sock`

---

## Related Documentation

- `docs/ARCHITECTURE.md` - System architecture
- `docs/FEATURES.md` - Feature specifications
- `docs/PHASES.md` - Implementation roadmap
- `docs/DATA-MODELS.md` - Detailed data structures
- `docs/QUICKSTART.md` - Getting started guide
- `docs/PROGRESS.md` - Detailed implementation progress (for Claude)
