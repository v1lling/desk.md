"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  /** Label to display (e.g., "tasks", "projects") */
  label?: string;
  /** Custom height class (default: h-64) */
  height?: string;
  /** Custom className */
  className?: string;
  /** Show spinner instead of pulsing text */
  spinner?: boolean;
}

/**
 * Consistent loading state for lists and content areas
 */
export function LoadingState({
  label = "content",
  height = "h-64",
  className,
  spinner = false,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        height,
        className
      )}
    >
      {spinner ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : (
        <div className="animate-pulse text-muted-foreground">
          Loading {label}...
        </div>
      )}
    </div>
  );
}
