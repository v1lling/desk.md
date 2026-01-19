"use client";

import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "./workspace-switcher";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Settings,
  ChevronLeft,
  Inbox,
  CheckSquare,
  StickyNote,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

// Workspace-scoped navigation items
const workspaceNavItems = [
  { href: "/", label: "All Tasks", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/notes", label: "Notes", icon: FileText },
] as const;

// Personal space navigation items
const personalNavItems = [
  { href: "/personal/inbox", label: "Inbox", icon: Inbox },
  { href: "/personal/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/personal/notes", label: "Notes", icon: StickyNote },
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

  // Check if we're in personal space
  const isPersonalRoute = pathname.startsWith("/personal");

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
        {/* Personal Section */}
        <div className="mb-4">
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              <User className="size-3" />
              <span>Personal</span>
            </div>
          )}
          <div className="space-y-1">
            {personalNavItems.map((item) => (
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
        </div>

        {/* Workspace Section */}
        <div>
          {!collapsed && (
            <div className="px-3 py-1.5 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              Workspace
            </div>
          )}
          <div className="space-y-1">
            {workspaceNavItems.map((item) => (
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
        </div>
      </nav>

      {/* Footer */}
      <div className="shrink-0 px-3 pb-3 pt-2 border-t border-sidebar-border/50 space-y-1">
        <NavLink
          href="/settings"
          label="Settings"
          icon={Settings}
          isActive={pathname === "/settings"}
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
