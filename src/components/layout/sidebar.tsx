"use client";

import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "./workspace-switcher";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Settings,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const navItems = [
  { href: "/", label: "All Tasks", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

// Extracted nav link component to avoid style duplication
function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <Icon
        className={cn(
          "size-[18px] shrink-0",
          isActive
            ? "text-sidebar-accent-foreground"
            : "text-sidebar-foreground/60"
        )}
      />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();

  // Separate settings from main nav items
  const mainNavItems = navItems.slice(0, -1);
  const settingsItem = navItems[navItems.length - 1];

  return (
    <aside
      className={cn(
        "flex flex-col h-full min-h-0 bg-sidebar border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header: Workspace Switcher + Collapse Toggle */}
      <div className="shrink-0 p-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>
        {onToggle && !collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="size-8 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={pathname === item.href}
              collapsed={collapsed}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="shrink-0 px-3 pb-3 pt-2 border-t border-sidebar-border/50 space-y-1">
        <NavLink
          href={settingsItem.href}
          label={settingsItem.label}
          icon={settingsItem.icon}
          isActive={pathname === settingsItem.href}
          collapsed={collapsed}
        />

        {/* Expand button - only shown when collapsed */}
        {collapsed && onToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="w-full h-9 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
          >
            <ChevronLeft className="size-4 rotate-180" />
          </Button>
        )}
      </div>
    </aside>
  );
}
