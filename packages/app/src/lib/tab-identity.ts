import { getScopedEntityKey } from "@desk/core";

type EntityTabType = "doc" | "task" | "meeting";

export function getEntityTabId(
  type: EntityTabType,
  entity: { id: string; workspaceId: string; projectId: string },
): string {
  return `${type}-${getScopedEntityKey(entity)}`;
}
