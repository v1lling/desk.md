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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MenuItem } from "./tree-item-utils";

interface TreeItemMenusProps {
  items: MenuItem[];
  children: ReactNode;
}

/**
 * Wraps a tree item with a right-click ContextMenu. The hover "..." dropdown is
 * a separate component (TreeItemDropdown) rendered inside the row.
 */
export function TreeItemMenus({
  items,
  children,
}: TreeItemMenusProps) {
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
 * The "..." dropdown button + menu. Render this inside the tree item row.
 */
export function TreeItemDropdown({
  items,
  open,
  onOpenChange,
}: {
  items: MenuItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-5 opacity-0 group-hover:opacity-100 transition-opacity ml-1",
            open && "opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <RenderDropdownMenuItems items={items} />
      </DropdownMenuContent>
    </DropdownMenu>
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

function RenderDropdownMenuItems({ items }: { items: MenuItem[] }) {
  return (
    <>
      {items.map((item, idx) => {
        if (item === "separator") return <DropdownMenuSeparator key={idx} />;
        if (item.submenu) {
          return (
            <DropdownMenuSub key={idx}>
              <DropdownMenuSubTrigger>
                {item.icon}
                {item.label}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {item.submenu.map((sub, subIdx) => (
                  <DropdownMenuItem key={subIdx} onClick={sub.onClick}>
                    {sub.icon}
                    {sub.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        }
        return (
          <DropdownMenuItem
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
            }}
            className={item.destructive ? "text-destructive focus:text-destructive" : undefined}
          >
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
