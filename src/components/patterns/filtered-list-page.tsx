"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { EntityFilterBar, type FilterConfig } from "@/components/ui/entity-filter-bar";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface FilteredListPageProps {
  // Action button (shown in filter bar)
  actionLabel?: string;
  onAction?: () => void;

  // Filter configuration
  filters: FilterConfig[];
  count: number;
  countLabel: string;

  // View mode toggle (optional)
  viewMode?: "list" | "kanban";
  onViewModeChange?: (mode: "list" | "kanban") => void;

  // Content
  children: React.ReactNode;

  // Modal (rendered at the end)
  modal?: React.ReactNode;
}

/**
 * Common page layout for filtered list views.
 * Provides: Filter Bar + Scroll Area + Optional Modal
 * (Header removed - page title comes from tab)
 */
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
}: FilteredListPageProps) {
  // Build right element: view toggle + action button
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
    <div className="flex flex-col h-full">
      <EntityFilterBar
        filters={filters}
        count={count}
        countLabel={countLabel}
        rightElement={rightElement}
      />

      <ScrollArea className="flex-1">
        <main className={viewMode === "kanban" ? "px-4 pt-2 pb-4" : "p-4"}>
          {children}
        </main>
      </ScrollArea>

      {modal}
    </div>
  );
}
