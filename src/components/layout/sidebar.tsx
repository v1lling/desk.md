
/**
 * Sidebar - "Work Mode" Navigation
 *
 * Structure:
 * - Search bar
 * - Dashboard
 * - Global views (Tasks, Docs, Meetings) - filtered by workspace
 * - Projects list (for current workspace)
 * - Settings
 * - Workspace selector at bottom (includes Personal as an option)
 */

import { cn } from "@/lib/utils";
import {
  FileText,
  Settings,
  ChevronLeft,
  CheckSquare,
  Calendar,
  Home,
  Search,
  Bot,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCurrentWorkspace } from "@/stores/workspaces";
import { useTasks } from "@/stores/tasks";
import { useDocs } from "@/stores/content";
import { useMeetings } from "@/stores/meetings";
import { ProjectsList } from "./projects-list";
import { WorkspaceSelector } from "./workspace-selector";
import { useOpenTab } from "@/stores/tabs";
import { useTabStore } from "@/stores/tabs";
import type { LucideIcon } from "lucide-react";

interface SidebarProps {
  width: number;
  isCollapsed: boolean;
  onToggle?: () => void;
  isDragging?: boolean;
}

// Nav link component
function NavLink({
  to,
  label,
  icon: Icon,
  isActive,
  collapsed,
  count,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  collapsed: boolean;
  count?: number;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          isActive
            ? "text-sidebar-accent-foreground"
            : "text-sidebar-foreground/60"
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {count !== undefined && count > 0 && (
            <span className={cn(
              "text-[10px] tabular-nums font-medium",
              isActive ? "text-sidebar-accent-foreground/60" : "text-sidebar-foreground/40"
            )}>
              {count}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

// Divider
function Divider() {
  return <div className="h-px bg-sidebar-border/50 my-2 mx-2" />;
}

export function Sidebar({ width, isCollapsed, onToggle, isDragging }: SidebarProps) {
  const { pathname } = useLocation();
  const currentWorkspace = useCurrentWorkspace();
  const workspaceId = currentWorkspace?.id || null;

  // Fetch counts for sidebar badges
  const { data: tasks = [] } = useTasks(workspaceId);
  const { data: docs = [] } = useDocs(workspaceId);
  const { data: meetings = [] } = useMeetings(workspaceId);

  // Count active tasks (not done)
  const activeTaskCount = tasks.filter((t) => t.status !== "done").length;
  const docCount = docs.length;
  const meetingCount = meetings.length;

  // AI Chat
  const { openAI } = useOpenTab();
  const activeTabId = useTabStore((s) => s.activeTabId);
  const isAIChatActive = activeTabId === "ai";

  // Use isCollapsed for conditional rendering
  const collapsed = isCollapsed;

  return (
    <aside
      className={cn(
        "flex flex-col h-full min-h-0 bg-sidebar",
        // Only animate when not dragging
        !isDragging && "transition-[width] duration-200"
      )}
      style={{ width: `${width}px` }}
    >
      {/* Header: Search + Collapse Toggle */}
      <div className="shrink-0 p-2 flex items-center gap-1.5 border-b border-sidebar-border/50">
        {!collapsed ? (
          <>
            <button
              onClick={() => {
                const event = new KeyboardEvent("keydown", {
                  key: "k",
                  metaKey: true,
                  bubbles: true,
                });
                document.dispatchEvent(event);
              }}
              className="flex-1 flex items-center gap-2 px-2.5 py-1 rounded-md bg-sidebar-accent/30 text-sidebar-foreground/50 text-sm hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70 transition-colors"
            >
              <Search className="size-3.5" />
              <span className="flex-1 text-left text-xs">Search...</span>
              <kbd className="text-[10px] font-medium bg-sidebar-accent/50 px-1 py-0.5 rounded">
                ⌘K
              </kbd>
            </button>
            {onToggle && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="size-7 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
            )}
          </>
        ) : (
          <button
            onClick={() => {
              const event = new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              });
              document.dispatchEvent(event);
            }}
            className="w-full flex items-center justify-center py-1 rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground/70 transition-colors"
            title="Search (⌘K)"
          >
            <Search className="size-4" />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <ScrollArea className="flex-1 h-0">
        <nav className="px-2 py-2 space-y-1">
          {/* Dashboard - top level */}
          <NavLink
            to="/"
            label="Dashboard"
            icon={Home}
            isActive={pathname === "/"}
            collapsed={collapsed}
          />

          <Divider />

          {/* Global Views (workspace-filtered) */}
          <div className="space-y-0.5">
            <NavLink
              to="/tasks"
              label="Tasks"
              icon={CheckSquare}
              isActive={pathname === "/tasks"}
              collapsed={collapsed}
              count={activeTaskCount}
            />
            <NavLink
              to="/docs"
              label="Docs"
              icon={FileText}
              isActive={pathname === "/docs"}
              collapsed={collapsed}
              count={docCount}
            />
            <NavLink
              to="/meetings"
              label="Meetings"
              icon={Calendar}
              isActive={pathname === "/meetings"}
              collapsed={collapsed}
              count={meetingCount}
            />
          </div>

          <Divider />

          {/* Projects (for current workspace) */}
          <ProjectsList isCollapsed={collapsed} />
        </nav>
      </ScrollArea>

      {/* Footer: AI Chat + Settings */}
      <div className="shrink-0 px-2 pb-1 pt-1.5 border-t border-sidebar-border/50 space-y-0.5">
        <button
          onClick={openAI}
          className={cn(
            "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors w-full",
            collapsed && "justify-center px-0",
            isAIChatActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
          title={collapsed ? "AI Chat (⌘⇧A)" : undefined}
        >
          <Bot
            className={cn(
              "size-4 shrink-0",
              isAIChatActive
                ? "text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60"
            )}
          />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">AI Chat</span>
              <kbd className={cn(
                "text-[10px] font-medium px-1 py-0.5 rounded",
                isAIChatActive ? "bg-sidebar-accent-foreground/10" : "bg-sidebar-accent/50"
              )}>
                ⌘⇧A
              </kbd>
            </>
          )}
        </button>
        <NavLink
          to="/settings"
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
            className="w-full h-7 mt-1 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
          >
            <ChevronLeft className="size-3.5 rotate-180" />
          </Button>
        )}
      </div>

      {/* Workspace Selector ("Work Mode") */}
      <WorkspaceSelector isCollapsed={collapsed} />
    </aside>
  );
}
