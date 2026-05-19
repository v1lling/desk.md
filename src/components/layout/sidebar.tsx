/**
 * Sidebar - enterprise navigation contract.
 */

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings,
  CheckSquare,
  Calendar,
  CalendarDays,
  Home,
  Bot,
  FileText,
  FolderKanban,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useCallback, useMemo } from "react";
import { useCurrentWorkspace } from "@/stores/workspaces";
import { useTasks } from "@/stores/tasks";
import { useWorkspaceOverviewShell } from "@/stores/content";
import { useMeetings } from "@/stores/meetings";
import { extractDocs, extractAssets } from "@/lib/desk/content";
import { useProjects } from "@/stores/projects";
import { WorkspaceSelector } from "./workspace-selector";
import { useOpenTab } from "@/stores/tabs";
import { useTabStore } from "@/stores/tabs";
import { SidebarNavRow } from "./sidebar-nav-row";

interface SidebarProps {
  width: number;
  isCollapsed: boolean;
  isDragging?: boolean;
}

function Divider() {
  return <div className="h-px bg-sidebar-border/60 my-2 mx-2" />;
}

export function Sidebar({ width, isCollapsed, isDragging }: SidebarProps) {
  const { pathname } = useLocation();
  const currentWorkspace = useCurrentWorkspace();
  const workspaceId = currentWorkspace?.id || null;

  const { data: tasks = [] } = useTasks(workspaceId);
  const { data: overviewTree = [] } = useWorkspaceOverviewShell(workspaceId);
  const { data: meetings = [] } = useMeetings(workspaceId);
  const { data: projects = [] } = useProjects(workspaceId);

  const activeTaskCount = tasks.filter((t) => t.status !== "done" && t.status !== "backlog").length;
  const totalFiles = useMemo(() => {
    let count = 0;
    for (const node of overviewTree) {
      if (node.type === "doc" || node.type === "asset") {
        count++;
      } else if (node.type === "folder" && node.folder.isProject) {
        count += (node.folder.docCount ?? 0) + (node.folder.assetCount ?? 0);
      } else if (node.type === "folder") {
        count += extractDocs([node]).length + extractAssets([node]).length;
      }
    }
    return count;
  }, [overviewTree]);
  const meetingCount = meetings.length;
  const projectCount = projects.length;

  const { openAI } = useOpenTab();
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const isAssistantActive = activeTabId === "ai";
  const switchToDesk = useCallback(() => setActiveTab("desk"), [setActiveTab]);

  const collapsed = isCollapsed;

  return (
    <aside
      data-app-chrome
      className={cn(
        "flex flex-col h-full min-h-0 bg-sidebar",
        !isDragging && "transition-[width] duration-200"
      )}
      style={{ width: `${width}px` }}
    >
      <ScrollArea className="flex-1 min-h-0">
        <nav className="px-2 py-2 space-y-1">
          <SidebarNavRow to="/" label="Dashboard" icon={Home} active={pathname === "/"} collapsed={collapsed} role="global" onClick={switchToDesk} />
          <SidebarNavRow to="/planner" label="Planner" icon={CalendarDays} active={pathname === "/planner"} collapsed={collapsed} role="global" onClick={switchToDesk} />

          <Divider />

          {!collapsed && (
            <div className="px-2.5 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/45">
              Workspace Views
            </div>
          )}

          <div className="space-y-0.5">
            <SidebarNavRow to="/tasks" label="Tasks" icon={CheckSquare} active={pathname === "/tasks"} collapsed={collapsed} role="global" count={activeTaskCount} onClick={switchToDesk} />
            <SidebarNavRow to="/docs" label="Docs" icon={FileText} active={pathname === "/docs"} collapsed={collapsed} role="global" count={totalFiles} onClick={switchToDesk} />
            <SidebarNavRow to="/meetings" label="Meetings" icon={Calendar} active={pathname === "/meetings"} collapsed={collapsed} role="global" count={meetingCount} onClick={switchToDesk} />
            <SidebarNavRow to="/projects" label="Projects" icon={FolderKanban} active={pathname.startsWith("/projects")} collapsed={collapsed} role="global" count={projectCount} onClick={switchToDesk} />
          </div>

          <Divider />
        </nav>
      </ScrollArea>

      <div className="shrink-0 px-2 pb-1 pt-1.5 border-t border-sidebar-border/60 space-y-0.5">
        <SidebarNavRow
          onClick={openAI}
          label="Assistant"
          icon={Bot}
          active={isAssistantActive}
          collapsed={collapsed}
          role="global"
        />
        <SidebarNavRow to="/settings" label="Settings" icon={Settings} active={pathname === "/settings"} collapsed={collapsed} role="global" onClick={switchToDesk} />

      </div>

      <WorkspaceSelector isCollapsed={collapsed} />
    </aside>
  );
}
