import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SecondarySidebarProps {
  width: number;
  isCollapsed: boolean;
  isDragging?: boolean;
  onExpand?: () => void;
  children: ReactNode;
}

/**
 * Presentational wrapper for the per-route secondary sidebar slot.
 * App shell decides whether to render this (only when a page has registered content).
 */
export function SecondarySidebar({
  width,
  isCollapsed,
  isDragging,
  onExpand,
  children,
}: SecondarySidebarProps) {
  if (isCollapsed) {
    return (
      <aside
        data-app-chrome
        className="flex flex-col h-full min-h-0 bg-background border-r border-border/60 items-center py-2"
        style={{ width: `${width}px` }}
      >
        {onExpand && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={onExpand}
            title="Expand panel"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
      </aside>
    );
  }

  return (
    <aside
      data-app-chrome
      className={cn(
        "flex flex-col h-full min-h-0 bg-background border-r border-border/60 overflow-hidden",
        !isDragging && "transition-[width] duration-200"
      )}
      style={{ width: `${width}px` }}
    >
      {children}
    </aside>
  );
}
