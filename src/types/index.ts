// Area - represents a client/workspace
export interface Area {
  id: string;              // Folder name
  name: string;            // Display name
  description?: string;
  color?: string;          // Hex color for UI
  created: string;         // ISO date
}

// Project - lives under an area
export interface Project {
  id: string;              // Folder name
  areaId: string;          // Parent area
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
  noteCount?: number;
}

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

// Task - lives under a project
export interface Task {
  id: string;              // Filename without .md
  projectId: string;       // Parent project (or "_unassigned")
  areaId: string;
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

// Note - lives under a project
export interface Note {
  id: string;              // Filename without .md
  projectId: string;
  areaId: string;
  filePath: string;
  title: string;
  created: string;
  content: string;
  preview?: string;        // First ~100 chars
}

// Meeting - lives under a project
export interface Meeting {
  id: string;              // Filename without .md
  projectId: string;
  areaId: string;
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
  currentAreaId: string | null;
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

// View state - UI preferences stored in .view.json per project
export interface ProjectViewState {
  /** Task ordering by status column */
  taskOrder?: Record<TaskStatus, string[]>;
}
