"use client";

import { cn } from "@/lib/utils";
import { Check, Cloud, CloudOff, Loader2 } from "lucide-react";
import type { SaveStatus } from "@/hooks/use-auto-save";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  className?: string;
}

/**
 * Visual indicator for auto-save status
 * Shows: idle (nothing) | saving (spinner) | saved (checkmark) | error (cloud-off)
 */
export function SaveStatusIndicator({
  status,
  className,
}: SaveStatusIndicatorProps) {
  if (status === "idle") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground transition-opacity",
        status === "error" && "text-destructive",
        className
      )}
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3 w-3" />
          <span>Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <CloudOff className="h-3 w-3" />
          <span>Save failed</span>
        </>
      )}
    </div>
  );
}

export default SaveStatusIndicator;
