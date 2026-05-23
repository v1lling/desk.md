/**
 * Centralized Design Tokens
 *
 * This file contains all design constants used across the application.
 * Using these tokens ensures visual consistency and makes future updates easier.
 *
 * Usage:
 * - Import specific tokens: import { priorityMeta, statusColors } from "@/lib/design-tokens"
 * - Use with cn(): cn("text-sm", priorityMeta.high.color)
 */

import { SignalHigh, SignalMedium, SignalLow, type LucideIcon } from "lucide-react";

// =============================================================================
// PRIORITY
// One source of truth for every place priority is shown or selected: a
// signal-bar icon + colour per level. Traffic-light hues so the levels are
// instantly distinguishable — calm green for low, neutral grey for medium,
// urgent rose for high.
// =============================================================================

export type Priority = "high" | "medium" | "low";

export const priorityMeta: Record<
  Priority,
  { label: string; icon: LucideIcon; color: string }
> = {
  high: { label: "High", icon: SignalHigh, color: "text-rose-500 dark:text-rose-400" },
  medium: { label: "Medium", icon: SignalMedium, color: "text-muted-foreground" },
  low: { label: "Low", icon: SignalLow, color: "text-emerald-500 dark:text-emerald-400" },
};

/** Ordered list of priorities for consistent display (highest first). */
export const priorityOrder: Priority[] = ["high", "medium", "low"];

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
// WORKSPACE COLORS
// Default color palette for workspaces - refined selection
// =============================================================================

export const workspaceColorOptions: readonly { value: string; label: string }[] = [
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
  backlog: "bg-slate-500",
  todo: "bg-muted-foreground",
  doing: "bg-blue-500",
  waiting: "bg-amber-500/80",
  done: "bg-emerald-500",
} as const;

export type TaskStatus = keyof typeof taskStatusColors;

// =============================================================================
// TASK STATUS TEXT COLORS
// Used for status icons and text in the overview
// =============================================================================

export const taskStatusTextColors = {
  backlog: "text-slate-600 dark:text-slate-400",
  todo: "text-muted-foreground",
  doing: "text-blue-600 dark:text-blue-400",
  waiting: "text-amber-600 dark:text-amber-500",
  done: "text-emerald-600 dark:text-emerald-400",
} as const;

// =============================================================================
// TASK STATUS CONFIG
// Complete status configuration with labels for UI display
// =============================================================================

export const taskStatusLabels = {
  backlog: "Backlog",
  todo: "To Do",
  doing: "In Progress",
  waiting: "Waiting",
  done: "Done",
} as const;

/** Ordered list of statuses for consistent display across views */
export const taskStatusOrder: TaskStatus[] = ["backlog", "todo", "doing", "waiting", "done"];

// =============================================================================
// ICON ASSIGNMENTS
// Standardized icon mapping to ensure consistency across the app
// Import icons from here instead of directly from lucide-react for consistency
// =============================================================================

export {
  // Navigation
  Home as IconDashboard,
  Settings as IconSettings,
  Search as IconSearch,

  // Content types - STANDARDIZED
  CheckSquare as IconTasks,      // Use for all task references
  FileText as IconDocs,          // Use for all doc references
  Calendar as IconMeetings,      // Use for meetings
  FolderKanban as IconProjects,  // Use for projects/workspaces

  // Personal space
  User as IconPersonal,

  // Actions
  Plus as IconAdd,
  Trash2 as IconDelete,
  Loader2 as IconLoading,
  ChevronDown as IconChevronDown,
  ChevronRight as IconChevronRight,
  ChevronLeft as IconChevronLeft,
  Circle as IconCircle,
} from "lucide-react";
