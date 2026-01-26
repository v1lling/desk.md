"use client";

import { useCallback } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { TabItem } from "@/stores/tabs";

interface TabContextMenuProps {
  tab: TabItem;
  children: React.ReactNode;
  hasOtherClosableTabs: boolean;
  onClose: () => void;
  onCloseOthers: () => void;
}

export function TabContextMenu({
  tab,
  children,
  hasOtherClosableTabs,
  onClose,
  onCloseOthers,
}: TabContextMenuProps) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleCloseOthers = useCallback(() => {
    onCloseOthers();
  }, [onCloseOthers]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {!tab.isPinned && (
          <ContextMenuItem onClick={handleClose}>
            Close
            <ContextMenuShortcut>Cmd+W</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={handleCloseOthers}
          disabled={!hasOtherClosableTabs}
        >
          Close Others
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
