
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

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
            {t("menus.tabContextMenu.close")}
            {/* eslint-disable-next-line i18next/no-literal-string -- keyboard shortcut label, not translatable */}
            <ContextMenuShortcut>Cmd+W</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={handleCloseOthers}
          disabled={!hasOtherClosableTabs}
        >
          {t("menus.tabContextMenu.closeOthers")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
