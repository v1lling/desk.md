import { type ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import type { MenuItem } from "./tree-item-utils";

interface TreeItemMenusProps {
  items: MenuItem[];
  children: ReactNode;
}

/** True when `items` has at least one clickable action (separators don't count). */
function hasActionableItems(items: MenuItem[]): boolean {
  return items.some((item) => item !== "separator");
}

/**
 * Wraps a tree item with a right-click ContextMenu. The hover "..." dropdown is
 * a separate component (TreeItemDropdown) rendered inside the row.
 *
 * With no actionable items (e.g. a project stub), skip the menu entirely so
 * right-clicking doesn't pop an empty box.
 */
export function TreeItemMenus({
  items,
  children,
}: TreeItemMenusProps) {
  if (!hasActionableItems(items)) return <>{children}</>;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <RenderContextMenuItems items={items} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * The "..." button. Render this inside the tree item row.
 *
 * Not a separate menu: clicking it opens the row's existing right-click ContextMenu (via a
 * synthetic `contextmenu` event bubbling to the TreeItemMenus trigger wrapping the row). One
 * menu system per row on purpose — the previous element-anchored DropdownMenu re-anchored /
 * fought focus inside the virtualized, drag-enabled arborist rows on WKWebView (the menu
 * visibly jumped and items were unclickable), while the coordinate-anchored ContextMenu is
 * stable everywhere.
 */
export function TreeItemDropdown({ items }: { items: MenuItem[] }) {
  // No actionable items → no "..." button (e.g. a project stub).
  if (!hasActionableItems(items)) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-5 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
      onClick={(e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            clientX: rect.left,
            clientY: rect.bottom + 2,
          }),
        );
      }}
    >
      <MoreHorizontal className="size-3.5" />
    </Button>
  );
}

// ── Internal renderers ──────────────────────────────────────────────

function RenderContextMenuItems({ items }: { items: MenuItem[] }) {
  return (
    <>
      {items.map((item, idx) => {
        if (item === "separator") return <ContextMenuSeparator key={idx} />;
        if (item.submenu) {
          return (
            <ContextMenuSub key={idx}>
              <ContextMenuSubTrigger>
                {item.icon}
                {item.label}
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {item.submenu.map((sub, subIdx) => (
                  <ContextMenuItem key={subIdx} onClick={sub.onClick}>
                    {sub.icon}
                    {sub.label}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          );
        }
        return (
          <ContextMenuItem
            key={idx}
            onClick={item.onClick}
            className={item.destructive ? "text-destructive focus:text-destructive" : undefined}
          >
            {item.icon}
            {item.label}
          </ContextMenuItem>
        );
      })}
    </>
  );
}

