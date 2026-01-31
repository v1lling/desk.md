/**
 * Desk Constants
 *
 * Centralized constants for file paths, special directories, and other magic values.
 * Using these constants ensures consistency and makes future changes easier.
 */

// =============================================================================
// SPECIAL DIRECTORY NAMES
// Used for special folders like unassigned items
// =============================================================================

export const SPECIAL_DIRS = {
  /** Directory for tasks/docs not assigned to any project */
  UNASSIGNED: "_unassigned",
  /** Personal workspace directory (treated as a workspace) */
  PERSONAL: "_personal",
  /** Capture project for quick triage (within Personal workspace) */
  CAPTURE: "_capture",
} as const;

// =============================================================================
// PATH SEGMENTS
// Standard directory names used in the file structure
// =============================================================================

export const PATH_SEGMENTS = {
  WORKSPACES: "workspaces",
  PERSONAL: "personal",
  PROJECTS: "projects",
  TASKS: "tasks",
  DOCS: "docs",
  MEETINGS: "meetings",
  CAPTURE: "capture",
} as const;

/**
 * Personal workspace ID - matches the folder name _personal
 * Personal is treated as a regular workspace in the UI
 */
export const PERSONAL_WORKSPACE_ID = "_personal" as const;

/**
 * Workspace-level project ID - used for docs/content at workspace level (not in any project)
 * This is a virtual project ID, not an actual directory.
 */
export const WORKSPACE_LEVEL_PROJECT_ID = "_workspace" as const;

// =============================================================================
// FILE NAMES
// Standard file names used in the project structure
// =============================================================================

export const FILE_NAMES = {
  WORKSPACE_MD: "workspace.md",
  PROJECT_MD: "project.md",
  VIEW_STATE: ".view.json",
} as const;

// =============================================================================
// TYPE HELPERS
// =============================================================================

export type SpecialDir = (typeof SPECIAL_DIRS)[keyof typeof SPECIAL_DIRS];
export type PathSegment = (typeof PATH_SEGMENTS)[keyof typeof PATH_SEGMENTS];

/**
 * Check if a project ID represents unassigned items
 */
export function isUnassigned(projectId: string): boolean {
  return projectId === SPECIAL_DIRS.UNASSIGNED;
}

/**
 * Check if a workspace ID is the Personal workspace
 */
export function isPersonalWorkspace(workspaceId: string | null): boolean {
  return workspaceId === SPECIAL_DIRS.PERSONAL;
}

/**
 * Check if a project ID is the Capture area
 */
export function isCapture(projectId: string): boolean {
  return projectId === SPECIAL_DIRS.CAPTURE;
}
