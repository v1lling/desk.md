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

/** Special "workspace ID" used for personal space items */
export const PERSONAL_SPACE_ID = "__personal__" as const;

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
