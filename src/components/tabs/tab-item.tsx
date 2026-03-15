
import { memo, useCallback } from "react";
import { Home, FileText, CheckSquare, Calendar, Mail, Bot, Zap, X } from "lucide-react";
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
  agent: Zap,
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
  showIcon?: boolean;
  isMainTab?: boolean;
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
  showIcon = true,
  isMainTab = false,
}: TabItemProps) {
  const Icon = TAB_ICONS[tab.type];
  const isDeskTab = tab.type === "desk";
  const isAITab = tab.type === "ai";
  const isAgentTab = tab.type === "agent";
  const isSystemTab = isDeskTab || isAITab || isAgentTab;

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
          "group relative flex items-center gap-1.5 text-xs transition-colors px-3",
          isMainTab
            ? "w-[140px] shrink-0"
            : isSystemTab
              ? "w-[120px] shrink-0"
              : "w-[160px] shrink-0",
          isMainTab
            ? isActive
              ? "h-8 text-foreground font-medium border-b-2 border-foreground/50 rounded-none"
              : "h-8 text-muted-foreground/80 hover:text-foreground hover:bg-muted/20 rounded-none border-b-2 border-transparent"
            : isActive
              ? "h-[33px] bg-background text-foreground font-medium border-x border-t border-border/50 rounded-t-md -mb-px z-10"
              : "h-8 bg-transparent text-muted-foreground/80 hover:text-foreground hover:bg-muted/30 rounded-t-md"
        )}
      >
        {/* Workspace color indicator for Desk tab */}
        {isDeskTab && workspaceColor && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: workspaceColor }}
          />
        )}
        {showIcon && (
          <Icon className={cn("h-3.5 w-3.5 shrink-0", isAITab && "text-violet-500")} />
        )}
        <span className="truncate flex-1">{tab.title}</span>

        {/* Subtle dirty indicator */}
        {tab.isDirty && (
          <span className="text-muted-foreground/60 shrink-0 text-[10px] leading-none">
            •
          </span>
        )}

        {/* Close button (hidden for pinned tabs) */}
        {!tab.isPinned && (
          <span
            role="button"
            tabIndex={-1}
            onClick={handleCloseClick}
            className={cn(
              "ml-1 p-0.5 rounded hover:bg-accent transition-opacity",
              isActive ? "opacity-60" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>
    </TabContextMenu>
  );
});
