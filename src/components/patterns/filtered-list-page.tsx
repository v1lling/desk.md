import { ScrollArea } from "@/components/ui/scroll-area";
import { FilterBar, type FilterBarConfig } from "@/components/ui/filter-bar";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageHeader } from "./page-header";
import { densityClasses, type Density } from "@/lib/enterprise-ui";
import type { Workspace } from "@/types";

interface FilteredListPageProps {
  title: string;
  workspace?: Workspace | null;
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
  density = "regular",
}: FilteredListPageProps) {
  const contentPadding = viewMode === "kanban" ? "px-4 pt-2 pb-4" : densityClasses[density].content;

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
      <PageHeader title={title} workspace={workspace} density={density} />

      <FilterBar
        filters={filters}
        count={count}
        countLabel={countLabel}
        rightElement={rightElement}
        density={density}
      />

      <ScrollArea className="flex-1">
        <main className={contentPadding}>{children}</main>
      </ScrollArea>

      {modal}
    </div>
  );
}
