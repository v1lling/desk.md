"use client";

import { memo, useCallback } from "react";
import { Home, FileText, CheckSquare, Calendar, Mail, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TabItem as TabItemType, TabType } from "@/stores/tabs";
import { TabContextMenu } from "./tab-context-menu";

const TAB_ICONS: Record<TabType, React.ElementType> = {
  orbit: Home,
  doc: FileText,
  task: CheckSquare,
  meeting: Calendar,
  email: Mail,
};

interface TabItemProps {
  tab: TabItemType;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onMiddleClick: () => void;
  onCloseOthers: () => void;
  hasOtherClosableTabs: boolean;
  /** Workspace color indicator (for Orbit tab on workspace-scoped pages) */
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
  const isOrbitTab = tab.type === "orbit";

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
        isOrbitTab
          ? "min-w-[100px] max-w-[180px] px-2.5 shrink-0"
          : "min-w-[80px] max-w-[140px] px-2.5 shrink",
        // Orbit tab has special styling with thicker separator
        isOrbitTab
          ? cn(
              "border-r-2 border-border",
              isActive
                ? "bg-accent text-accent-foreground font-medium"
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )
          : cn(
              "border-r border-border/50",
              isActive
                ? "bg-background text-foreground"
                : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )
      )}
    >
      {/* Workspace color indicator for Orbit tab */}
      {isOrbitTab && workspaceColor && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: workspaceColor }}
        />
      )}
      <Icon className="h-3.5 w-3.5 shrink-0" />
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

      {/* Active indicator line - uses workspace color for Orbit tab if available */}
      {isActive && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground/50"
          style={isOrbitTab && workspaceColor ? { backgroundColor: workspaceColor } : undefined}
        />
      )}
    </button>
    </TabContextMenu>
  );
});
