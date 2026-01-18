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
// KANBAN COLUMN STATUS INDICATORS
// Dot colors for kanban column headers
// =============================================================================

export const kanbanStatusColors = {
  todo: "bg-slate-400 dark:bg-slate-500",
  doing: "bg-blue-500 dark:bg-blue-400",
  done: "bg-emerald-500 dark:bg-emerald-400",
} as const;

export type TaskStatus = keyof typeof kanbanStatusColors;

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
// SPACING
// Consistent spacing values (matches Tailwind defaults)
// =============================================================================

export const spacing = {
  /** 4px - Tight spacing for inline elements */
  xs: "1",
  /** 8px - Small gaps */
  sm: "2",
  /** 12px - Default component padding */
  md: "3",
  /** 16px - Standard gap between elements */
  lg: "4",
  /** 24px - Section spacing */
  xl: "6",
  /** 32px - Large section spacing */
  "2xl": "8",
} as const;

// =============================================================================
// LAYOUT
// Common layout dimensions
// =============================================================================

export const layout = {
  /** Sidebar width when expanded */
  sidebarWidth: "w-64",
  /** Sidebar width when collapsed */
  sidebarCollapsedWidth: "w-16",
  /** Header height */
  headerHeight: "h-14",
  /** Main content padding */
  contentPadding: "p-6",
  /** Card border radius (matches --radius) */
  cardRadius: "rounded-lg",
  /** Modal max width */
  modalWidth: "sm:max-w-[500px]",
} as const;

// =============================================================================
// TYPOGRAPHY
// Text styles for consistency
// =============================================================================

export const typography = {
  /** Page titles */
  pageTitle: "text-xl font-semibold tracking-tight",
  /** Section headings */
  sectionTitle: "text-lg font-semibold tracking-tight",
  /** Card titles */
  cardTitle: "text-[15px] font-semibold",
  /** Small labels */
  label: "text-sm font-medium",
  /** Helper/muted text */
  helper: "text-[13px] text-muted-foreground",
  /** Tiny text (badges, counts) */
  tiny: "text-[11px]",
} as const;

// =============================================================================
// TRANSITIONS
// Animation durations and timing
// =============================================================================

export const transitions = {
  /** Fast hover transitions */
  fast: "transition-all duration-150",
  /** Default transitions */
  default: "transition-all duration-200",
  /** Slow/emphasized transitions */
  slow: "transition-all duration-300",
} as const;

// =============================================================================
// SHADOWS
// Consistent shadow styles
// =============================================================================

export const shadows = {
  /** Subtle card shadow */
  card: "shadow-sm",
  /** Hover state shadow */
  hover: "hover:shadow-md",
  /** Elevated elements */
  elevated: "shadow-md",
  /** Modal/overlay shadow */
  modal: "shadow-xl",
} as const;

// =============================================================================
// INTERACTIVE STATES
// Common interactive element styling
// =============================================================================

export const interactive = {
  /** Card hover effect */
  cardHover: "hover:shadow-md hover:border-border transition-all duration-150",
  /** Button-like elements */
  clickable: "cursor-pointer active:scale-[0.98] transition-transform duration-100",
} as const;
