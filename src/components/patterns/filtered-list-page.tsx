"use client";

import { Header } from "@/components/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EntityFilterBar, type FilterConfig } from "@/components/ui/entity-filter-bar";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";

interface FilteredListPageProps {
  title: string;
  subtitle?: string;

  // Action button in header
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
 * Provides: Header + Filter Bar + Scroll Area + Optional Modal
 */
export function FilteredListPage({
  title,
  subtitle,
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
  return (
    <div className="flex flex-col h-full">
      <Header
        title={title}
        subtitle={subtitle}
        action={actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined}
      />

      <EntityFilterBar
        filters={filters}
        count={count}
        countLabel={countLabel}
        rightElement={
          viewMode && onViewModeChange ? (
            <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
          ) : undefined
        }
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
