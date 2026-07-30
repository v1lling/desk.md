import type { BuildIndexResult, WorkspaceIndex } from "@desk/core";
import type { Workspace } from "@desk/core/types";

export interface SmartIndexWorkspaceRow {
  id: string;
  name: string;
  fileCount: number;
  updatedAt: string;
  color: string;
}

export interface SmartIndexOverview {
  totalIndexFiles: number;
  summarizedCount: number;
  pendingCount: number;
  workspaceRows: SmartIndexWorkspaceRow[];
}

export function deriveSmartIndexOverview(
  indexes: Record<string, WorkspaceIndex>,
  workspaces: Workspace[],
): SmartIndexOverview {
  const allEntries = Object.values(indexes).flatMap((index) => index.entries);
  const totalIndexFiles = allEntries.length;
  const summarizedCount = allEntries.filter((entry) => entry.summary).length;

  const workspaceColors = new Map(
    workspaces.map((workspace) => [workspace.id, workspace.color ?? "#6366f1"]),
  );
  const workspaceRows = Object.values(indexes)
    .map((index) => ({
      id: index.workspaceId,
      name: index.workspaceName,
      fileCount: index.fileCount,
      updatedAt: index.updatedAt ?? index.builtAt,
      color: workspaceColors.get(index.workspaceId) ?? "#6366f1",
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    totalIndexFiles,
    summarizedCount,
    pendingCount: totalIndexFiles - summarizedCount,
    workspaceRows,
  };
}

export function mergeBuildIndexResults(
  current: BuildIndexResult | null,
  next: BuildIndexResult,
): BuildIndexResult {
  if (!current) return next;

  return {
    totalFiles: current.totalFiles + next.totalFiles,
    summarized: current.summarized + next.summarized,
    reused: current.reused + next.reused,
    excluded: current.excluded + next.excluded,
    errors: [...current.errors, ...next.errors],
  };
}
