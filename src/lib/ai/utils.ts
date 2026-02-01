/**
 * Parse a docPath to extract workspaceId and entityId for opening in a tab.
 * Path format: /Users/.../workspaces/{workspaceId}/projects/{projectId}/docs/{entityId}.md
 * Or: /Users/.../workspaces/{workspaceId}/_unassigned/{entityId}.md
 */
export function parseDocPath(docPath: string): { workspaceId: string; entityId: string } | null {
  // Extract workspaceId from path
  const workspaceMatch = docPath.match(/\/workspaces\/([^/]+)\//);
  if (!workspaceMatch) return null;
  const workspaceId = workspaceMatch[1];

  // Extract entityId from filename (remove .md extension)
  const filename = docPath.split('/').pop();
  if (!filename) return null;
  const entityId = filename.replace(/\.md$/, '');

  return { workspaceId, entityId };
}
