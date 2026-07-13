/**
 * Centralized Path Builders
 *
 * Single source of truth for all file path construction.
 * Eliminates duplication across tasks.ts, content.ts, meetings.ts.
 *
 * File Structure:
 * ~/Desk/
 * ├── workspaces/
 * │   └── {workspaceId}/           (one folder per workspace)
 * │       ├── workspace.md         (frontmatter `home: true` marks the home workspace)
 * │       ├── context/             (The map: evergreen, maintained, co-authored)
 * │       ├── docs/                (Records: dated, accumulate, never rewritten)
 * │       ├── _capture/            (Quick capture for triage — home workspace only)
 * │       │   └── tasks/
 * │       ├── _unassigned/
 * │       │   ├── tasks/
 * │       │   ├── docs/
 * │       │   └── meetings/
 * │       └── projects/{projectId}/
 * │           ├── project.md
 * │           ├── context/
 * │           ├── tasks/
 * │           ├── docs/
 * │           └── meetings/
 */

import type { ContentScope } from "../types";
import { getDeskPath, joinPath } from "./env";
import { PATH_SEGMENTS, SPECIAL_DIRS, isUnassigned, isCapture } from "./constants";
import { getHomeWorkspaceId } from "./workspaces";

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
 * Note: The 'personal' scope maps to the home workspace.
 */
export async function getDocsPath(
  scope: ContentScope,
  workspaceId?: string,
  projectId?: string
): Promise<string> {
  if (scope === "personal") {
    // Personal scope doesn't require workspaceId — always maps to the home workspace
    const workspacePath = await getWorkspacePath(await getHomeWorkspaceId());
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

/**
 * Get the context directory based on scope (parallel to getDocsPath for context/)
 */
export async function getContextPath(
  scope: ContentScope,
  workspaceId?: string,
  projectId?: string
): Promise<string> {
  if (scope === "personal") {
    const workspacePath = await getWorkspacePath(await getHomeWorkspaceId());
    return joinPath(workspacePath, PATH_SEGMENTS.CONTEXT);
  }

  if (!workspaceId) {
    throw new Error("workspaceId required for workspace/project scope");
  }

  if (scope === "workspace") {
    const workspacePath = await getWorkspacePath(workspaceId);
    return joinPath(workspacePath, PATH_SEGMENTS.CONTEXT);
  }

  // scope === "project"
  if (!projectId) {
    throw new Error("projectId required for project scope");
  }

  const projectPath = await getProjectPath(workspaceId, projectId);
  return joinPath(projectPath, PATH_SEGMENTS.CONTEXT);
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
// HOME WORKSPACE PATHS (convenience functions)
// The home workspace is an ordinary workspace folder marked `home: true`.
// =============================================================================

/**
 * Get the home workspace root directory
 * @returns ~/Desk/workspaces/{homeWorkspaceId}
 */
export async function getHomeWorkspacePath(): Promise<string> {
  return getWorkspacePath(await getHomeWorkspaceId());
}

/**
 * Get the capture tasks directory (for quick triage)
 * @returns ~/Desk/workspaces/{homeWorkspaceId}/_capture/tasks
 */
export async function getCapturePath(): Promise<string> {
  return getTasksPath(await getHomeWorkspaceId(), SPECIAL_DIRS.CAPTURE);
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
