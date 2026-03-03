/**
 * Centralized Path Builders
 *
 * Single source of truth for all file path construction.
 * Eliminates duplication across tasks.ts, content.ts, meetings.ts.
 *
 * File Structure:
 * ~/Desk/
 * ├── workspaces/
 * │   ├── _personal/               (Personal workspace - treated like any workspace)
 * │   │   ├── workspace.md
 * │   │   ├── docs/
 * │   │   ├── _capture/            (Quick capture for triage)
 * │   │   │   └── tasks/
 * │   │   ├── _unassigned/
 * │   │   │   ├── tasks/
 * │   │   │   └── docs/
 * │   │   └── projects/{projectId}/
 * │   │       ├── project.md
 * │   │       ├── tasks/
 * │   │       └── docs/
 * │   └── {workspaceId}/           (Client workspaces)
 * │       ├── workspace.md
 * │       ├── docs/
 * │       ├── _unassigned/
 * │       │   ├── tasks/
 * │       │   ├── docs/
 * │       │   └── meetings/
 * │       └── projects/{projectId}/
 * │           ├── project.md
 * │           ├── tasks/
 * │           ├── docs/
 * │           └── meetings/
 */

import type { ContentScope } from "@/types";
import { getDeskPath, joinPath } from "./tauri-fs";
import { PATH_SEGMENTS, SPECIAL_DIRS, isUnassigned, isCapture, isPersonalWorkspace } from "./constants";

// =============================================================================
// WORKSPACE PATHS
// =============================================================================

/**
 * Get the workspaces root directory
 * @returns ~/Desk/workspaces
 */
export async function getWorkspacesPath(): Promise<string> {
  const deskPath = await getDeskPath();
  return joinPath(deskPath, PATH_SEGMENTS.WORKSPACES);
}

/**
 * Get a specific workspace's root directory
 * @returns ~/Desk/workspaces/{workspaceId}
 */
export async function getWorkspacePath(workspaceId: string): Promise<string> {
  const deskPath = await getDeskPath();
  return joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId);
}

/**
 * Get the workspace.md file path
 * @returns ~/Desk/workspaces/{workspaceId}/workspace.md
 */
export async function getWorkspaceFilePath(workspaceId: string): Promise<string> {
  const workspacePath = await getWorkspacePath(workspaceId);
  return joinPath(workspacePath, "workspace.md");
}

// =============================================================================
// PROJECT PATHS
// =============================================================================

/**
 * Get the projects root directory for a workspace
 * @returns ~/Desk/workspaces/{workspaceId}/projects
 */
export async function getProjectsPath(workspaceId: string): Promise<string> {
  const workspacePath = await getWorkspacePath(workspaceId);
  return joinPath(workspacePath, PATH_SEGMENTS.PROJECTS);
}

/**
 * Get a specific project's root directory
 * Handles special directories: _unassigned, _capture
 * @returns ~/Desk/workspaces/{workspaceId}/projects/{projectId}
 *     or: ~/Desk/workspaces/{workspaceId}/_unassigned
 *     or: ~/Desk/workspaces/{workspaceId}/_capture (Personal workspace only)
 */
export async function getProjectPath(
  workspaceId: string,
  projectId: string
): Promise<string> {
  const workspacePath = await getWorkspacePath(workspaceId);

  // Special directories are at workspace root level
  if (isUnassigned(projectId)) {
    return joinPath(workspacePath, SPECIAL_DIRS.UNASSIGNED);
  }

  if (isCapture(projectId)) {
    return joinPath(workspacePath, SPECIAL_DIRS.CAPTURE);
  }

  return joinPath(workspacePath, PATH_SEGMENTS.PROJECTS, projectId);
}

/**
 * Get the project.md file path
 * @returns ~/Desk/workspaces/{workspaceId}/projects/{projectId}/project.md
 */
export async function getProjectFilePath(
  workspaceId: string,
  projectId: string
): Promise<string> {
  const projectPath = await getProjectPath(workspaceId, projectId);
  return joinPath(projectPath, "project.md");
}

// =============================================================================
// TASKS PATHS
// =============================================================================

/**
 * Get the tasks directory for a project (or unassigned)
 * @returns ~/Desk/workspaces/{workspaceId}/projects/{projectId}/tasks
 *     or: ~/Desk/workspaces/{workspaceId}/_unassigned/tasks
 */
export async function getTasksPath(
  workspaceId: string,
  projectId: string
): Promise<string> {
  const projectPath = await getProjectPath(workspaceId, projectId);
  return joinPath(projectPath, PATH_SEGMENTS.TASKS);
}

// =============================================================================
// DOCS PATHS
// =============================================================================

/**
 * Get the docs directory based on scope
 *
 * @param scope - 'workspace' | 'project' (personal is now a workspace)
 * @param workspaceId - Required for all scopes
 * @param projectId - Required for 'project' scope
 *
 * @returns
 *   workspace: ~/Desk/workspaces/{workspaceId}/docs
 *   project:   ~/Desk/workspaces/{workspaceId}/projects/{projectId}/docs
 *         or:  ~/Desk/workspaces/{workspaceId}/_unassigned/docs
 *
 * Note: For Personal docs, use scope='workspace' with workspaceId='_personal'
 */
export async function getDocsPath(
  scope: ContentScope,
  workspaceId?: string,
  projectId?: string
): Promise<string> {
  if (scope === "personal") {
    // Personal scope doesn't require workspaceId — always maps to _personal
    const workspacePath = await getWorkspacePath(SPECIAL_DIRS.PERSONAL);
    return joinPath(workspacePath, PATH_SEGMENTS.DOCS);
  }

  if (!workspaceId) {
    throw new Error("workspaceId required for workspace/project scope");
  }

  if (scope === "workspace") {
    const workspacePath = await getWorkspacePath(workspaceId);
    return joinPath(workspacePath, PATH_SEGMENTS.DOCS);
  }

  // scope === "project"
  if (!projectId) {
    throw new Error("projectId required for project scope");
  }

  const projectPath = await getProjectPath(workspaceId, projectId);
  return joinPath(projectPath, PATH_SEGMENTS.DOCS);
}

// =============================================================================
// MEETINGS PATHS
// =============================================================================

/**
 * Get the meetings directory for a project (or unassigned)
 * @returns ~/Desk/workspaces/{workspaceId}/projects/{projectId}/meetings
 *     or: ~/Desk/workspaces/{workspaceId}/_unassigned/meetings
 */
export async function getMeetingsPath(
  workspaceId: string,
  projectId: string
): Promise<string> {
  const projectPath = await getProjectPath(workspaceId, projectId);
  return joinPath(projectPath, PATH_SEGMENTS.MEETINGS);
}

// =============================================================================
// PERSONAL WORKSPACE PATHS (convenience functions)
// Personal is now a workspace at ~/Desk/workspaces/_personal/
// =============================================================================

/**
 * Get the Personal workspace root directory
 * @returns ~/Desk/workspaces/_personal
 */
export async function getPersonalWorkspacePath(): Promise<string> {
  return getWorkspacePath(SPECIAL_DIRS.PERSONAL);
}

/**
 * Get the capture tasks directory (for quick triage)
 * @returns ~/Desk/workspaces/_personal/_capture/tasks
 */
export async function getCapturePath(): Promise<string> {
  return getTasksPath(SPECIAL_DIRS.PERSONAL, SPECIAL_DIRS.CAPTURE);
}

// =============================================================================
// UNASSIGNED PATHS (convenience functions)
// =============================================================================

/**
 * Get the unassigned directory for a workspace
 * @returns ~/Desk/workspaces/{workspaceId}/_unassigned
 */
export async function getUnassignedPath(workspaceId: string): Promise<string> {
  const workspacePath = await getWorkspacePath(workspaceId);
  return joinPath(workspacePath, SPECIAL_DIRS.UNASSIGNED);
}

/**
 * Get the unassigned tasks directory
 * @returns ~/Desk/workspaces/{workspaceId}/_unassigned/tasks
 */
export async function getUnassignedTasksPath(workspaceId: string): Promise<string> {
  return getTasksPath(workspaceId, SPECIAL_DIRS.UNASSIGNED);
}

/**
 * Get the unassigned docs directory
 * @returns ~/Desk/workspaces/{workspaceId}/_unassigned/docs
 */
export async function getUnassignedDocsPath(workspaceId: string): Promise<string> {
  return getDocsPath("project", workspaceId, SPECIAL_DIRS.UNASSIGNED);
}

/**
 * Get the unassigned meetings directory
 * @returns ~/Desk/workspaces/{workspaceId}/_unassigned/meetings
 */
export async function getUnassignedMeetingsPath(workspaceId: string): Promise<string> {
  return getMeetingsPath(workspaceId, SPECIAL_DIRS.UNASSIGNED);
}
