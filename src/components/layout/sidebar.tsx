/**
 * Sidebar - enterprise navigation contract.
 */

import { cn } from "@/lib/utils";
import {
  Settings,
  ChevronLeft,
  CheckSquare,
  Calendar,
  Home,
  Search,
  Bot,
  FileText,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCurrentWorkspace } from "@/stores/workspaces";
import { useTasks } from "@/stores/tasks";
import { useDocs } from "@/stores/content";
import { useMeetings } from "@/stores/meetings";
import { ProjectsList } from "./projects-list";
import { WorkspaceSelector } from "./workspace-selector";
import { useOpenTab } from "@/stores/tabs";
import { useTabStore } from "@/stores/tabs";
import { SidebarNavRow } from "./sidebar-nav-row";

interface SidebarProps {
  width: number;
  isCollapsed: boolean;
  onToggle?: () => void;
  isDragging?: boolean;
}

function Divider() {
  return <div className="h-px bg-sidebar-border/60 my-2 mx-2" />;
}

export function Sidebar({ width, isCollapsed, onToggle, isDragging }: SidebarProps) {
  const { pathname } = useLocation();
  const currentWorkspace = useCurrentWorkspace();
  const workspaceId = currentWorkspace?.id || null;

  const { data: tasks = [] } = useTasks(workspaceId);
  const { data: docs = [] } = useDocs(workspaceId);
  const { data: meetings = [] } = useMeetings(workspaceId);

  const activeTaskCount = tasks.filter((t) => t.status !== "done" && t.status !== "backlog").length;
  const docCount = docs.length;
  const meetingCount = meetings.length;

  const { openAI } = useOpenTab();
  const activeTabId = useTabStore((s) => s.activeTabId);
  const isAssistantActive = activeTabId === "ai";

  const collapsed = isCollapsed;

  return (
    <aside
      className={cn(
        "flex flex-col h-full min-h-0 bg-sidebar border-r border-sidebar-border/70",
        !isDragging && "transition-[width] duration-200"
      )}
      style={{ width: `${width}px` }}
    >
      <div className="shrink-0 p-2 flex items-center gap-1.5 border-b border-sidebar-border/60">
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
              className="flex-1 flex items-center gap-2 px-2.5 py-1 rounded-md bg-sidebar-accent/35 text-sidebar-foreground/60 text-sm hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/80 transition-colors"
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

      <div className="flex-1 min-h-0 flex flex-col">
        <nav className="px-2 py-2 space-y-1 shrink-0">
          <SidebarNavRow to="/" label="Dashboard" icon={Home} active={pathname === "/"} collapsed={collapsed} role="global" />

          <Divider />

          {!collapsed && (
            <div className="px-2.5 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/45">
              Workspace Views
            </div>
          )}

          <div className="space-y-0.5">
            <SidebarNavRow to="/tasks" label="Tasks" icon={CheckSquare} active={pathname === "/tasks"} collapsed={collapsed} role="global" count={activeTaskCount} />
            <SidebarNavRow to="/docs" label="Docs" icon={FileText} active={pathname === "/docs"} collapsed={collapsed} role="global" count={docCount} />
            <SidebarNavRow to="/meetings" label="Meetings" icon={Calendar} active={pathname === "/meetings"} collapsed={collapsed} role="global" count={meetingCount} />
          </div>

          <Divider />
        </nav>

        <div className="flex-1 min-h-0 px-2 pb-2">
          <ProjectsList isCollapsed={collapsed} />
        </div>
      </div>

      <div className="shrink-0 px-2 pb-1 pt-1.5 border-t border-sidebar-border/60 space-y-0.5">
        <SidebarNavRow
          onClick={openAI}
          label="Assistant"
          icon={Bot}
          active={isAssistantActive}
          collapsed={collapsed}
          role="global"
        />
        <SidebarNavRow to="/settings" label="Settings" icon={Settings} active={pathname === "/settings"} collapsed={collapsed} role="global" />

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

      <WorkspaceSelector isCollapsed={collapsed} />
    </aside>
  );
}
