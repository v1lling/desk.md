/** User-owned overview bodies stored in workspace.md and project.md. */

/**
 * Seed a compact workspace overview without duplicating the workspace name as an H1.
 */
export function overviewTemplate(description?: string): string {
  const text = description?.trim() || "";
  return text ? `## What this is\n\n${text}\n` : "";
}
