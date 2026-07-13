import { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronsUpDown, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ListPaneSortOption {
  key: string;
  /** Full item label, including any asc/desc suffix the caller wants to show. */
  label: React.ReactNode;
  icon?: LucideIcon;
  active?: boolean;
  onSelect: () => void;
}

interface ListPaneProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Defaults to the shared t("common.listPane.searchPlaceholder"). */
  searchPlaceholder?: string;
  sortOptions?: ListPaneSortOption[];
  /** DropdownMenuItem children for the header overflow menu. */
  menuItems?: React.ReactNode;
  /** Optional filter row rendered between the header and the count row. */
  filter?: React.ReactNode;
  /** Pre-translated count text, e.g. t("...meetingCount", { count }). */
  countLabel: string;
  action?: { label: string; onClick: () => void };
  /**
   * Wrap children in a ScrollArea (default). Disable for bodies that manage
   * their own scrolling/measuring (the docs arborist tree).
   */
  scroll?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * The shared secondary-sidebar pane shell: search + sort + overflow header,
 * optional filter row, count + action row, and a scrollable body. Used by the
 * docs, meetings, and projects panes so the chrome exists exactly once.
 */
export function ListPane({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  sortOptions,
  menuItems,
  filter,
  countLabel,
  action,
  scroll = true,
  children,
  className,
}: ListPaneProps) {
  const { t } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      {/* Header: search + sort + more */}
      <div className="shrink-0 min-h-11 py-2 px-3 border-b border-border/60 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={searchPlaceholder ?? t("common.listPane.searchPlaceholder")}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onSearchChange("");
            }}
            className="h-7 pl-7 pr-7 text-xs"
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                onSearchChange("");
                searchInputRef.current?.focus();
              }}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        {sortOptions && sortOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                title={t("common.listPane.sortTitle")}
              >
                <ChevronsUpDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.key}
                  onClick={option.onSelect}
                  className={cn(option.active && "bg-accent")}
                >
                  {option.icon && <option.icon className="size-4 mr-2" />}
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {menuItems != null && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">{menuItems}</DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Optional filter row */}
      {filter != null && (
        <div className="shrink-0 px-3 py-2 border-b border-border/40">{filter}</div>
      )}

      {/* Count + action row */}
      <div className="shrink-0 px-3 py-1 flex items-center gap-2 border-b border-border/40">
        <span className="text-xs text-muted-foreground tabular-nums">{countLabel}</span>
        <div className="flex-1" />
        {action && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={action.onClick}>
            <Plus className="size-3.5 mr-1" />
            {action.label}
          </Button>
        )}
      </div>

      {/* Body */}
      {scroll ? (
        <ScrollArea className="flex-1 min-h-0">
          <div className="py-1">{children}</div>
        </ScrollArea>
      ) : (
        children
      )}
    </div>
  );
}
