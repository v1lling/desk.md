/**
 * Business Logic Calculations
 *
 * Centralized utility functions for data calculations.
 * Extracted from components to enable reuse and easier testing.
 */

import type { Task, TaskStatus } from "@/types";

// =============================================================================
// TASK STATISTICS
// =============================================================================

export interface TaskStats {
  total: number;
  todo: number;
  doing: number;
  waiting: number;
  done: number;
}

/**
 * Calculate task statistics from an array of tasks
 */
export function calculateTaskStats(tasks: Task[]): TaskStats {
  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    doing: tasks.filter((t) => t.status === "doing").length,
    waiting: tasks.filter((t) => t.status === "waiting").length,
    done: tasks.filter((t) => t.status === "done").length,
  };
}

/**
 * Calculate completion percentage for tasks
 */
export function calculateCompletionPercentage(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

/**
 * Group tasks by status
 */
export function groupTasksByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  return {
    todo: tasks.filter((t) => t.status === "todo"),
    doing: tasks.filter((t) => t.status === "doing"),
    waiting: tasks.filter((t) => t.status === "waiting"),
    done: tasks.filter((t) => t.status === "done"),
  };
}
