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

  // Group entries: docs first, then AI docs, then tasks, then meetings
  const typeOrder: Record<string, number> = { doc: 0, "ai-doc": 1, task: 2, meeting: 3 };
  const grouped = [...index.entries].sort((a, b) => {
    const orderDiff = (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
    if (orderDiff !== 0) return orderDiff;
    const dateA = a.date ?? a.created ?? '';
    const dateB = b.date ?? b.created ?? '';
    return dateB.localeCompare(dateA);
  });

  let currentType = "";
  for (const entry of grouped) {
    // Section headers
    if (entry.type !== currentType) {
      currentType = entry.type;
      const sectionName = entry.type === "ai-doc" ? "AI Docs" : entry.type === "doc" ? "Docs" : entry.type === "task" ? "Tasks" : "Meetings";
      lines.push(`## ${sectionName}`);
      lines.push("");
    }

    const meta: string[] = [];
    if (entry.projectName) meta.push(`project=${entry.projectName}`);
    if (entry.status) meta.push(`status=${entry.status}`);
    if (entry.priority) meta.push(`priority=${entry.priority}`);
    if (entry.date) meta.push(`date=${entry.date}`);

    lines.push(`### ${entry.path}`);
    lines.push(`- Title: ${entry.title}`);
    if (meta.length > 0) lines.push(`- Meta: ${meta.join(", ")}`);
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
