
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskViewMode } from "@/types";

interface ViewModeToggleProps {
  value: TaskViewMode;
  onChange: (mode: TaskViewMode) => void;
  className?: string;
}

/**
 * Toggle between list and kanban view modes
 * Minimalist design - just two icon buttons in a pill container
 */
export function ViewModeToggle({ value, onChange, className }: ViewModeToggleProps) {
  return (
    <div className={cn("flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50 border border-border/40", className)}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 rounded-md transition-colors",
          value === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-transparent"
        )}
        onClick={() => onChange("list")}
        title="List view"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 rounded-md transition-colors",
          value === "kanban"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-transparent"
        )}
        onClick={() => onChange("kanban")}
        title="Kanban board"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}
