"use client";

import { cn } from "@/lib/utils";
import { CloudOff } from "lucide-react";

/** Save status for editors */
export type SaveStatus = "idle" | "saving" | "error";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  className?: string;
  /** Compact mode: icon only, for header placement */
  compact?: boolean;
}

/**
 * Visual indicator for save status
 *
 * Design philosophy:
 * - Trust saves completely - no spinner, no "Saved" text
 * - Only show errors (critical feedback user needs to know)
 * - Silent success, loud failure
 */
export function SaveStatusIndicator({
  status,
  className,
  compact = false,
}: SaveStatusIndicatorProps) {
  // Only show errors - everything else is silent
  if (status !== "error") {
    return null;
  }

  if (compact) {
    // Header placement: icon only
    return (
      <div
        className={cn(
          "flex items-center justify-center h-8 w-8 text-destructive",
          className
        )}
        title="Save failed"
      >
        <CloudOff className="h-3.5 w-3.5" />
      </div>
    );
  }

  // Full mode: icon + text
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs text-destructive",
        className
      )}
    >
      <CloudOff className="h-3 w-3" />
      <span>Save failed</span>
    </div>
  );
}

export default SaveStatusIndicator;
