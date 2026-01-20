"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  /** Primary message */
  title: string;
  /** Optional secondary message with instructions */
  description?: string;
  /** Optional icon to display */
  icon?: LucideIcon;
  /** Custom className for the container */
  className?: string;
  /** Optional action element (e.g., button) */
  action?: React.ReactNode;
}

/**
 * Consistent empty state display for lists and grids
 * Use when a collection has no items to display
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  className,
  action,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      {Icon && (
        <Icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
      )}
      <p className="text-muted-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
