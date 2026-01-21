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
    todo: number;
    doing: number;
    waiting: number;
    done: number;
  };
  docCount?: number;
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

export type TaskStatus = 'todo' | 'doing' | 'waiting' | 'done';
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
}

// Keep Note as alias for backwards compatibility during migration
export type Note = Doc;

// Folder in the doc tree
export interface DocFolder {
  name: string;
  path: string;            // Relative path (e.g., "tech" or "tech/api")
  children: DocTreeNode[];
}

// Tree node - either a folder or a doc
export type DocTreeNode =
  | { type: 'folder'; folder: DocFolder }
  | { type: 'doc'; doc: Doc };

// Doc scope - where the doc lives
export type DocScope = 'personal' | 'workspace' | 'project';

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

// App configuration
export interface OrbitConfig {
  dataPath: string;
  currentWorkspaceId: string | null;
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  setupCompleted: boolean;
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

// View state - UI preferences stored in .view.json per project/personal space
export interface ProjectViewState {
  /** Task ordering by status column */
  taskOrder?: Record<TaskStatus, string[]>;
  /** View mode for tasks: list or kanban */
  viewMode?: 'list' | 'kanban';
  /** Expanded folder paths in doc tree */
  expandedDocFolders?: string[];
}

export type TaskViewMode = 'list' | 'kanban';
