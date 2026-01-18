/**
 * Centralized Design Tokens
 *
 * This file contains all design constants used across the application.
 * Using these tokens ensures visual consistency and makes future updates easier.
 *
 * Usage:
 * - Import specific tokens: import { priorityColors, statusColors } from "@/lib/design-tokens"
 * - Use with cn(): cn("text-sm", priorityColors.high)
 */

// =============================================================================
// PRIORITY COLORS
// Used for task priority badges - refined, softer colors
// =============================================================================

export const priorityColors = {
  high: "bg-rose-50 text-rose-600 border border-rose-200/50 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/50",
  medium: "bg-amber-50 text-amber-600 border border-amber-200/50 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50",
  low: "bg-emerald-50 text-emerald-600 border border-emerald-200/50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50",
} as const;

export type Priority = keyof typeof priorityColors;

// =============================================================================
// PROJECT STATUS COLORS
// Used for project status badges - refined with better dark mode support
// =============================================================================

export const statusColors = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200/50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50",
  paused: "bg-amber-50 text-amber-600 border-amber-200/50 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50",
  completed: "bg-blue-50 text-blue-600 border-blue-200/50 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/50",
  archived: "bg-slate-50 text-slate-500 border-slate-200/50 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-700/50",
} as const;

export type ProjectStatus = keyof typeof statusColors;

// =============================================================================
// AREA COLORS
// Default color palette for areas - refined selection
// =============================================================================

export const areaColorOptions: readonly { value: string; label: string }[] = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#ec4899", label: "Pink" },
  { value: "#64748b", label: "Slate" },
];

// =============================================================================
// TASK STATUS COLORS
// Used for kanban column headers and status indicators
// =============================================================================

export const taskStatusColors = {
  todo: "bg-muted-foreground",
  doing: "bg-blue-500",
  waiting: "bg-amber-500",
  done: "bg-emerald-500",
} as const;

export type TaskStatus = keyof typeof taskStatusColors;

// =============================================================================
// TASK STATUS TEXT COLORS
// Used for status icons and text in the overview
// =============================================================================

export const taskStatusTextColors = {
  todo: "text-muted-foreground",
  doing: "text-blue-600 dark:text-blue-400",
  waiting: "text-amber-600 dark:text-amber-400",
  done: "text-emerald-600 dark:text-emerald-400",
} as const;

// =============================================================================
// PRIORITY TEXT COLORS
// Used for priority badges in dropdowns (text only, no background)
// =============================================================================

export const priorityTextColors = {
  high: "text-rose-600 dark:text-rose-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-emerald-600 dark:text-emerald-400",
} as const;
