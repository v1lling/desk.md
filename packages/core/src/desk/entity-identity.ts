export interface EntityIdentity {
  id: string;
  workspaceId: string;
  projectId: string;
}

/**
 * File-derived IDs are intentionally stable only inside their owning project.
 * Use this key anywhere entities from multiple projects or workspaces coexist.
 */
export function getScopedEntityKey(entity: EntityIdentity): string {
  return [entity.workspaceId, entity.projectId, entity.id]
    .map(encodeURIComponent)
    .join("/");
}

export function isSameEntity(
  left: EntityIdentity,
  right: EntityIdentity,
): boolean {
  return left.id === right.id
    && left.workspaceId === right.workspaceId
    && left.projectId === right.projectId;
}
