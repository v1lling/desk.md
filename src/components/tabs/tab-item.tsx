"use client";

import { memo, useCallback } from "react";
import { Home, FileText, CheckSquare, Calendar, Mail, Bot, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TabItem as TabItemType, TabType } from "@/stores/tabs";
import { TabContextMenu } from "./tab-context-menu";

const TAB_ICONS: Record<TabType, React.ElementType> = {
  desk: Home,
  doc: FileText,
  task: CheckSquare,
  meeting: Calendar,
  email: Mail,
  ai: Bot,
};

interface TabItemProps {
  tab: TabItemType;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onMiddleClick: () => void;
  onCloseOthers: () => void;
  hasOtherClosableTabs: boolean;
  /** Workspace color indicator (for Desk tab on workspace-scoped pages) */
  workspaceColor?: string;
}

export const TabItem = memo(function TabItem({
  tab,
  isActive,
  onActivate,
  onClose,
  onMiddleClick,
  onCloseOthers,
  hasOtherClosableTabs,
  workspaceColor,
}: TabItemProps) {
  const Icon = TAB_ICONS[tab.type];
  const isDeskTab = tab.type === "desk";
  const isAITab = tab.type === "ai";
  const isSystemTab = isDeskTab || isAITab;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle click to close
      if (e.button === 1 && !tab.isPinned) {
        e.preventDefault();
        onMiddleClick();
      }
    },
    [tab.isPinned, onMiddleClick]
  );

  const handleCloseClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  return (
    <TabContextMenu
      tab={tab}
      hasOtherClosableTabs={hasOtherClosableTabs}
      onClose={onClose}
      onCloseOthers={onCloseOthers}
    >
      <button
        onClick={onActivate}
        onMouseDown={handleMouseDown}
        title={tab.title}
        className={cn(
        "group relative flex items-center gap-1.5 h-8 text-xs transition-colors",
        // Browser-like sizing: min width, can shrink, max width
        isSystemTab
          ? "min-w-[100px] max-w-[180px] px-2.5 shrink-0"
          : "min-w-[80px] max-w-[140px] px-2.5 shrink",
        // System tabs (Desk, AI) have special styling - always medium weight, with separator gap
        isSystemTab
          ? cn(
              "border-r-2 border-border mr-1 font-medium",
              isActive
                ? "bg-accent text-accent-foreground"
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )
          : cn(
              "border-r border-border/50",
              isActive
                ? "bg-background text-foreground font-medium"
                : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )
      )}
    >
      {/* Workspace color indicator for Desk tab */}
      {isDeskTab && workspaceColor && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: workspaceColor }}
        />
      )}
      <Icon className={cn("h-3.5 w-3.5 shrink-0", isAITab && "text-violet-500")} />
      <span className="truncate flex-1">{tab.title}</span>

      {/* Dirty indicator */}
      {tab.isDirty && (
        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
      )}

      {/* Close button (hidden for pinned tabs) */}
      {!tab.isPinned && (
        <span
          role="button"
          tabIndex={-1}
          onClick={handleCloseClick}
          className={cn(
            "ml-1 p-0.5 rounded hover:bg-accent",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isActive && "opacity-60"
          )}
        >
          <X className="h-3 w-3" />
        </span>
      )}

      {/* Active indicator line - uses workspace color for Desk tab, purple for AI tab */}
      {isActive && (
        <span
          className={cn(
            "absolute bottom-0 left-0 right-0 h-0.5",
            isAITab ? "bg-violet-500" : "bg-foreground/50"
          )}
          style={isDeskTab && workspaceColor ? { backgroundColor: workspaceColor } : undefined}
        />
      )}
    </button>
    </TabContextMenu>
  );
});
