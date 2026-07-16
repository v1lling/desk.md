import { ScrollArea } from "@/components/ui/scroll-area";
import { FilterBar, type FilterBarConfig } from "@/components/ui/filter-bar";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { densityClasses, type Density } from "@/lib/enterprise-ui";

interface FilteredListPageProps {
  actionLabel?: string;
  onAction?: () => void;
  filters: FilterBarConfig[];
  count: number;
  countLabel: string;
  viewMode?: "list" | "kanban";
  onViewModeChange?: (mode: "list" | "kanban") => void;
  children: React.ReactNode;
  modal?: React.ReactNode;
  density?: Density;
}

export function FilteredListPage({
  actionLabel,
  onAction,
  filters,
  count,
  countLabel,
  viewMode,
  onViewModeChange,
  children,
  modal,
  density = "regular",
}: FilteredListPageProps) {
  const isKanban = viewMode === "kanban";
  const contentPadding = isKanban ? "px-4 pt-2 pb-4" : densityClasses[density].content;

  const rightElement = (
    <>
      {viewMode && onViewModeChange && (
        <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
      )}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          <Plus className="size-4 mr-1" />
          {actionLabel}
        </Button>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <FilterBar
        filters={filters}
        count={count}
        countLabel={countLabel}
        rightElement={rightElement}
        density={density}
      />

      {/* Kanban fills the viewport: the OverlayScrollbars viewport becomes a flex column and
          main grows into it, so short boards stretch their lanes to the bottom while tall
          boards still grow and scroll naturally (grow, not a capped height). */}
      <ScrollArea
        className={cn(
          "flex-1",
          isKanban && "[&>[data-overlayscrollbars-viewport]]:flex [&>[data-overlayscrollbars-viewport]]:flex-col",
        )}
      >
        <main className={cn(contentPadding, isKanban && "flex grow flex-col")}>{children}</main>
      </ScrollArea>

      {modal}
    </div>
  );
}
