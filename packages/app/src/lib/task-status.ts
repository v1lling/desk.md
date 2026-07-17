import type { Project, TaskStatus } from "@desk/core/types";

/** Statuses that count as "in flight" — everything except `backlog` and `done`. */
const ACTIVE_STATUSES: TaskStatus[] = ["todo", "doing", "waiting"];

export function isActiveStatus(status: TaskStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Active-task total from a project's precomputed status counts. */
export function countActiveTasks(tasksByStatus: Project["tasksByStatus"]): number {
  if (!tasksByStatus) return 0;
  return tasksByStatus.todo + tasksByStatus.doing + tasksByStatus.waiting;
}
