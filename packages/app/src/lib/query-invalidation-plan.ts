import {
  getItemTypeFromPath,
  getProjectIdFromPath,
  getWorkspaceIdFromPath,
  isCapturePath,
} from "@desk/core";

export type QueryInvalidationTarget =
  | { type: "tasks"; workspaceId: string }
  | { type: "capture" }
  | { type: "view-state" }
  | { type: "content"; workspaceId: string }
  | {
      type: "content-tree";
      scope: "workspace" | "project";
      workspaceId: string;
      projectId?: string;
    }
  | { type: "meetings"; workspaceId: string }
  | { type: "projects"; workspaceId: string }
  | { type: "workspaces" }
  | { type: "dashboard" }
  | { type: "file-tree" };

/**
 * Convert a watcher batch into semantic query invalidations.
 *
 * This function deliberately has no cache or TanStack Query dependencies. The
 * watcher hook owns those effects; this module only decides what is affected.
 */
export function planQueryInvalidations(
  paths: readonly string[],
): QueryInvalidationTarget[] {
  const affectedTypes = new Set<string>();
  const affectedWorkspaces = new Set<string>();
  const affectedProjects = new Map<string, Set<string>>();
  let hasCaptureChanges = false;

  for (const path of paths) {
    const itemType = getItemTypeFromPath(path);
    const workspaceId = getWorkspaceIdFromPath(path);
    const projectId = getProjectIdFromPath(path);

    affectedTypes.add(itemType);
    if (workspaceId) {
      affectedWorkspaces.add(workspaceId);
      if (projectId) {
        const projects =
          affectedProjects.get(workspaceId) ?? new Set<string>();
        projects.add(projectId);
        affectedProjects.set(workspaceId, projects);
      }
    }
    if (isCapturePath(path)) {
      hasCaptureChanges = true;
    }
  }

  const targets: QueryInvalidationTarget[] = [];

  for (const itemType of affectedTypes) {
    switch (itemType) {
      case "task":
        for (const workspaceId of affectedWorkspaces) {
          targets.push({ type: "tasks", workspaceId });
        }
        if (hasCaptureChanges) targets.push({ type: "capture" });
        targets.push({ type: "view-state" });
        break;

      case "doc":
        for (const workspaceId of affectedWorkspaces) {
          targets.push({ type: "content", workspaceId });
          targets.push({
            type: "content-tree",
            scope: "workspace",
            workspaceId,
          });
          for (const projectId of affectedProjects.get(workspaceId) ?? []) {
            targets.push({
              type: "content-tree",
              scope: "project",
              workspaceId,
              projectId,
            });
          }
        }
        break;

      case "meeting":
        for (const workspaceId of affectedWorkspaces) {
          targets.push({ type: "meetings", workspaceId });
        }
        break;

      case "project":
        for (const workspaceId of affectedWorkspaces) {
          targets.push({ type: "projects", workspaceId });
        }
        break;

      case "workspace":
        targets.push({ type: "workspaces" });
        break;

      case "view":
        targets.push({ type: "view-state" });
        break;

      case "unknown":
        for (const workspaceId of affectedWorkspaces) {
          targets.push({ type: "tasks", workspaceId });
          targets.push({ type: "content", workspaceId });
          targets.push({ type: "meetings", workspaceId });
          targets.push({ type: "projects", workspaceId });
        }
        if (hasCaptureChanges) targets.push({ type: "capture" });
        break;
    }
  }

  if (
    [...affectedTypes].some((itemType) =>
      ["task", "doc", "meeting", "project", "workspace", "view", "unknown"].includes(itemType),
    )
  ) {
    targets.push({ type: "dashboard" });
  }

  targets.push({ type: "file-tree" });
  return targets;
}
