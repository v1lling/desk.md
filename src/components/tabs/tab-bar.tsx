"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTabStore } from "@/stores/tabs";
import { useCurrentWorkspace } from "@/stores/workspaces";
import { useProject } from "@/stores/projects";
import { TabItem } from "./tab-item";
import { ScrollArea } from "@/components/ui/scroll-area";

// Pages that are workspace-scoped (show workspace name and color)
const WORKSPACE_SCOPED_PAGES = ["/tasks", "/docs", "/meetings", "/projects/view"];

// Map pathname to friendly page name for Orbit tab
function getPageName(
  pathname: string,
  workspaceName?: string | null,
  projectName?: string | null
): { title: string; isWorkspaceScoped: boolean } {
  // Handle project detail page
  if (pathname === "/projects/view") {
    const name = projectName || "Project";
    return { title: name, isWorkspaceScoped: true };
  }

  const pageMap: Record<string, string> = {
    "/": "Dashboard",
    "/tasks": "Tasks",
    "/docs": "Docs",
    "/meetings": "Meetings",
    "/personal/tasks": "Personal Tasks",
    "/personal/docs": "Personal Docs",
    "/settings": "Settings",
  };

  const baseName = pageMap[pathname] || "Orbit";
  const isWorkspaceScoped = WORKSPACE_SCOPED_PAGES.includes(pathname);

  // For workspace-scoped pages, include workspace name
  if (isWorkspaceScoped && workspaceName) {
    return { title: `${baseName} · ${workspaceName}`, isWorkspaceScoped: true };
  }

  return { title: baseName, isWorkspaceScoped };
}

export function TabBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const setActiveTab = useTabStore((state) => state.setActiveTab);
  const closeTab = useTabStore((state) => state.closeTab);
  const closeOtherTabs = useTabStore((state) => state.closeOtherTabs);
  const updateTab = useTabStore((state) => state.updateTab);
  const currentWorkspace = useCurrentWorkspace();

  // Get project ID from URL for project pages
  const projectId = pathname === "/projects/view" ? searchParams.get("id") : null;
  const { data: project } = useProject(currentWorkspace?.id || null, projectId);

  // Track previous pathname to detect navigation
  const prevPathnameRef = useRef(pathname);

  // Auto-switch to Orbit tab when navigating via sidebar
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      // Navigation happened - switch to Orbit tab
      setActiveTab("orbit");
      prevPathnameRef.current = pathname;
    }
  }, [pathname, setActiveTab]);

  // Update Orbit tab title based on current page
  useEffect(() => {
    const { title } = getPageName(pathname, currentWorkspace?.name, project?.name);
    updateTab("orbit", { title });
  }, [pathname, currentWorkspace?.name, project?.name, updateTab]);

  // Get workspace color for Orbit tab (when on workspace-scoped page)
  const orbitWorkspaceColor = WORKSPACE_SCOPED_PAGES.includes(pathname)
    ? currentWorkspace?.color
    : undefined;

  const handleActivate = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
    },
    [setActiveTab]
  );

  const handleClose = useCallback(
    (tabId: string) => {
      closeTab(tabId);
    },
    [closeTab]
  );

  const handleCloseOthers = useCallback(
    (tabId: string) => {
      closeOtherTabs(tabId);
    },
    [closeOtherTabs]
  );

  // Check if there are other closable (non-pinned) tabs besides a given tab
  const hasOtherClosableTabs = useCallback(
    (tabId: string) => {
      return tabs.filter((t) => !t.isPinned && t.id !== tabId).length > 0;
    },
    [tabs]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+W to close current tab
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        const activeTab = tabs.find((t) => t.id === activeTabId);
        if (activeTab && !activeTab.isPinned) {
          e.preventDefault();
          closeTab(activeTabId);
        }
      }

      // Cmd+Shift+[ or ] to switch tabs
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        if (e.key === "[" && currentIndex > 0) {
          e.preventDefault();
          setActiveTab(tabs[currentIndex - 1].id);
        } else if (e.key === "]" && currentIndex < tabs.length - 1) {
          e.preventDefault();
          setActiveTab(tabs[currentIndex + 1].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, activeTabId, closeTab, setActiveTab]);

  // Only show tab bar if there are editor tabs open (not just Orbit)
  if (tabs.length <= 1) {
    return null;
  }

  return (
    <div className="h-9 bg-muted/50 border-b border-border flex items-center shrink-0">
      <ScrollArea orientation="horizontal" className="w-full h-full">
        <div className="flex items-center h-full">
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onActivate={() => handleActivate(tab.id)}
              onClose={() => handleClose(tab.id)}
              onMiddleClick={() => handleClose(tab.id)}
              onCloseOthers={() => handleCloseOthers(tab.id)}
              hasOtherClosableTabs={hasOtherClosableTabs(tab.id)}
              workspaceColor={tab.type === "orbit" ? orbitWorkspaceColor : undefined}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
