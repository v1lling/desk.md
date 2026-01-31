"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { EntityFilterBar, type FilterConfig } from "@/components/ui/entity-filter-bar";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { Button } from "@/components/ui/button";
import { Plus, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Workspace } from "@/types";

// Default workspace color
const DEFAULT_WORKSPACE_COLOR = "#64748b";

interface FilteredListPageProps {
  // Page title and workspace context
  title?: string;
  workspace?: Workspace | null;

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
 * Provides: Header (optional) + Filter Bar + Scroll Area + Optional Modal
 */
export function FilteredListPage({
  title,
  workspace,
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

  const workspaceColor = workspace?.color || DEFAULT_WORKSPACE_COLOR;

  return (
    <div className="flex flex-col h-full">
      {/* Page Header with workspace context */}
      {(title || workspace) && (
        <div className="shrink-0 h-12 px-4 flex items-center gap-3 border-b">
          {workspace && (
            <Circle
              className="size-3 shrink-0"
              style={{ color: workspaceColor }}
              fill={workspaceColor}
            />
          )}
          {title && <h1 className="text-base font-semibold">{title}</h1>}
          {workspace && (
            <Badge variant="outline" className="text-xs font-normal">
              {workspace.name}
            </Badge>
          )}
        </div>
      )}

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
