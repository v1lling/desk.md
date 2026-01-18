"use client";

import { cn } from "@/lib/utils";
import { AreaSwitcher } from "./area-switcher";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Settings,
  ChevronLeft,
  CircleDashed
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const navItems = [
  { href: "/", label: "All Tasks", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/unassigned", label: "Unassigned", icon: CircleDashed },
];

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Area Switcher */}
      <div className="p-3">
        <AreaSwitcher collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/60"
                )} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 pb-3 pt-2 border-t border-sidebar-border/50">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
            pathname === "/settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <Settings className={cn(
            "h-[18px] w-[18px] shrink-0 transition-colors",
            pathname === "/settings" ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/60"
          )} />
          {!collapsed && <span>Settings</span>}
        </Link>

        {onToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="w-full mt-2 justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                collapsed && "rotate-180"
              )}
            />
          </Button>
        )}
      </div>
    </aside>
  );
}
