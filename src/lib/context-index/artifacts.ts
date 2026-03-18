import { joinPath, writeTextFile } from "@/lib/desk/tauri-fs";
import { getWorkspacePath } from "@/lib/desk/paths";
import type { WorkspaceIndex } from "./types";
import { FILE_NAMES } from "@/lib/desk/constants";

function buildWorkspaceContext(index: WorkspaceIndex): string {
  const lines: string[] = [];
  lines.push(`# Workspace Context: ${index.workspaceName}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Files indexed: ${index.fileCount}`);
  lines.push("");
  lines.push("## Catalog");
  lines.push("");

  const entries = [...index.entries].sort((a, b) => {
    const dateA = a.date ?? a.created ?? '';
    const dateB = b.date ?? b.created ?? '';
    return dateB.localeCompare(dateA); // newest first
  });
  for (const entry of entries) {
    const meta: string[] = [entry.type];
    if (entry.projectName) meta.push(`project=${entry.projectName}`);
    if (entry.status) meta.push(`status=${entry.status}`);
    if (entry.priority) meta.push(`priority=${entry.priority}`);
    if (entry.date) meta.push(`date=${entry.date}`);

    lines.push(`### ${entry.path}`);
    lines.push(`- Title: ${entry.title}`);
    lines.push(`- Meta: ${meta.join(", ")}`);
    lines.push(`- Summary: ${entry.summary || "(no summary)"}`);
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

export async function writeWorkspaceContextArtifact(index: WorkspaceIndex): Promise<void> {
  const workspacePath = await getWorkspacePath(index.workspaceId);
  const filePath = await joinPath(workspacePath, FILE_NAMES.WORKSPACE_CONTEXT_MD);
  await writeTextFile(filePath, buildWorkspaceContext(index));
}
