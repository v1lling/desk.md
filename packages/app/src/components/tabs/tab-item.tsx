import { memo, useCallback } from "react";
import { Home, FileText, CheckSquare, Calendar, Mail, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TabItem as TabItemType, TabType } from "@/stores/tabs";
import { TabContextMenu } from "./tab-context-menu";

const TAB_ICONS: Record<TabType, React.ElementType> = {
  desk: Home,
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
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
          "group relative flex h-8 w-[150px] shrink-0 items-center gap-1.5 rounded-t-lg border border-transparent px-3 text-xs transition-colors",
          isActive
            ? "bg-background text-foreground border-border/80 border-b-background shadow-[0_-1px_0_rgba(0,0,0,0.02)]"
            : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          isMainTab && "font-medium"
        )}
      >
        {isDeskTab && workspaceColor && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: workspaceColor }}
          />
        )}
        {showIcon && (
          <Icon className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate flex-1 text-left">{tab.title}</span>

        {tab.isDirty && (
          <span className="text-muted-foreground/60 shrink-0 text-[10px] leading-none">•</span>
        )}

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
