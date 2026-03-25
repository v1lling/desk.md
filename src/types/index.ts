// Workspace - represents a client/context
export interface Workspace {
  id: string;              // Folder name
  name: string;            // Display name
  description?: string;
  color?: string;          // Hex color for UI
  created: string;         // ISO date
}

// Project - lives under a workspace
export interface Project {
  id: string;              // Folder name
  workspaceId: string;     // Parent workspace
  name: string;
  status: ProjectStatus;
  description?: string;
  created: string;         // ISO date
  taskCount?: number;
  tasksByStatus?: {
    backlog: number;
    todo: number;
    doing: number;
    waiting: number;
    done: number;
  };
  docCount?: number;
  meetingCount?: number;
}

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

// Task - lives under a project
export interface Task {
  id: string;              // Filename without .md
  projectId: string;       // Parent project (or "_unassigned")
  workspaceId: string;
  filePath: string;        // Full path to file
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  due?: string;            // ISO date
  created: string;
  content: string;         // Markdown body
}

export type TaskStatus = 'backlog' | 'todo' | 'doing' | 'waiting' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

// Doc - lives under a project (renamed from Note)
export interface Doc {
  id: string;              // Filename without .md
  path?: string;           // Relative path with folders (e.g., "tech/architecture.md")
  projectId: string;
  workspaceId: string;
  filePath: string;        // Full absolute path
  title: string;
  created: string;
  content: string;
  preview?: string;        // First ~100 chars
  fileCreated?: string;    // OS file creation time (ISO)
  fileModified?: string;   // OS file modification time (ISO)
}

// Folder in the content tree (can contain docs and assets)
export interface ContentFolder {
  name: string;
  path: string;            // Relative path (e.g., "tech" or "tech/api")
  children: FileTreeNode[];
  isProject?: boolean;     // True when this represents a project in workspace overview
  projectId?: string;      // Project ID (for project folders in overview)
  docCount?: number;       // Doc count for project folder header
  assetCount?: number;     // Asset count for project folder header
}

// Asset - non-markdown file (metadata only, opens externally)
export interface Asset {
  id: string;              // Filename (with extension), also used as display name
  path: string;            // Relative path with folders (e.g., "assets/logo.png")
  projectId: string;
  workspaceId: string;
  filePath: string;        // Full absolute path
  extension: string;       // File extension without dot (e.g., "pdf", "png")
  fileCreated?: string;    // OS file creation time (ISO)
  fileModified?: string;   // OS file modification time (ISO)
}

// Tree node - folder, doc, or asset
export type FileTreeNode =
  | { type: 'folder'; folder: ContentFolder }
  | { type: 'doc'; doc: Doc }
  | { type: 'asset'; asset: Asset };

// Content scope - where content (docs/assets) lives
export type ContentScope = 'personal' | 'workspace' | 'project';

/** Scope override for operations within project folders in workspace overview mode */
export interface ScopeOverride {
  scope: ContentScope;
  workspaceId: string;
  projectId: string;
}

// Meeting - lives under a project
export interface Meeting {
  id: string;              // Filename without .md
  projectId: string;
  workspaceId: string;
  filePath: string;
  title: string;
  date: string;            // ISO date - when the meeting occurred
  created: string;         // ISO date - when the note was created
  attendees?: string[];    // List of attendee names
  content: string;         // Markdown body (agenda, notes, action items)
  preview?: string;        // First ~100 chars
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// View state - UI preferences stored in .view.json per project/workspace
export interface ProjectViewState {
  /** Task ordering by status column */
  taskOrder?: Record<TaskStatus, string[]>;
  /** View mode for tasks: list or kanban */
  viewMode?: 'list' | 'kanban';
  /** Expanded folder paths in content tree */
  expandedFolders?: string[];
  /** Task IDs highlighted for focus (e.g., today's work) */
  highlightedTasks?: string[];
}

export type TaskViewMode = 'list' | 'kanban';

// ── Week Planner ────────────────────────────────────────────────────

/** A block of time allocated to a workspace on a specific day */
export interface WorkspaceBlock {
  id: string;                  // crypto.randomUUID() for drag-drop identity
  workspaceId: string;
  notes?: string;
  taskIds: string[];           // Ordered list of task IDs planned within this block
  startMinute: number;         // Minutes from midnight (e.g., 540 = 9:00)
  endMinute: number;           // Minutes from midnight (e.g., 1080 = 18:00)
}

/** A weekly plan (Mon–Sun of a given week) */
export interface WeekPlan {
  weekOf: string;              // ISO date of Monday, e.g. "2026-03-23"
  days: Record<string, WorkspaceBlock[]>;  // Keyed by ISO date
}
