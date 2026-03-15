
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Bot, Home, Zap } from "lucide-react";
import { useTabStore } from "@/stores/tabs";
import { useCurrentWorkspace } from "@/stores/workspaces";
import { useProject } from "@/stores/projects";
import type { TabType } from "@/stores/tabs";
import { TabItem } from "./tab-item";
import { SaveChangesDialog } from "@/components/ui/save-changes-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MAX_VISIBLE_DESKTOP = 8;
const MAX_VISIBLE_MOBILE = 5;

const SYSTEM_TAB_ICONS: Partial<Record<TabType, React.ElementType>> = {
  desk: Home,
  ai: Bot,
  agent: Zap,
};

// Pages that are workspace-scoped (show workspace name and color)
const WORKSPACE_SCOPED_PREFIXES = ["/tasks", "/docs", "/meetings", "/projects/"];

function isWorkspaceScopedPage(pathname: string): boolean {
  return WORKSPACE_SCOPED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Map pathname to friendly page name for Desk tab
function getPageName(
  pathname: string,
  projectName?: string | null
): { title: string; isWorkspaceScoped: boolean } {
  // Handle project detail page
  if (pathname.startsWith("/projects/")) {
    const name = projectName || "Project";
    return { title: name, isWorkspaceScoped: true };
  }

  const pageMap: Record<string, string> = {
    "/": "Dashboard",
    "/tasks": "Tasks",
    "/docs": "Docs",
    "/meetings": "Meetings",
    "/settings": "Settings",
  };

  const baseName = pageMap[pathname] || "Desk";
  const scoped = isWorkspaceScopedPage(pathname);

  return { title: baseName, isWorkspaceScoped: scoped };
}

export function TabBar() {
  const { pathname } = useLocation();
  const params = useParams();
  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const setActiveTab = useTabStore((state) => state.setActiveTab);
  const closeTab = useTabStore((state) => state.closeTab);
  const closeOtherTabs = useTabStore((state) => state.closeOtherTabs);
  const updateTab = useTabStore((state) => state.updateTab);
  const requestSaveAndClose = useTabStore((state) => state.requestSaveAndClose);
  const pendingSaveAndClose = useTabStore((state) => state.pendingSaveAndClose);
  const currentWorkspace = useCurrentWorkspace();
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);

  // State for unsaved changes dialog
  const [dirtyCloseDialog, setDirtyCloseDialog] = useState<{
    open: boolean;
    tabId: string | null;
    tabTitle: string;
    mode: "close-tab" | "close-others";
  }>({ open: false, tabId: null, tabTitle: "", mode: "close-tab" });
  const [closeOthersTargetTabId, setCloseOthersTargetTabId] = useState<string | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
    };

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Get project ID from URL for project pages
  const projectId = pathname.startsWith("/projects/") ? (params.id ?? null) : null;
  const { data: project } = useProject(currentWorkspace?.id || null, projectId);

  // Track previous pathname to detect navigation
  const prevPathnameRef = useRef(pathname);

  // Auto-switch to Desk tab when navigating via sidebar
  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      // Navigation happened - switch to Desk tab
      setActiveTab("desk");
      prevPathnameRef.current = pathname;
    }
  }, [pathname, setActiveTab]);

  // Update Desk tab title based on current page
  useEffect(() => {
    const { title } = getPageName(pathname, project?.name);
    updateTab("desk", { title });
  }, [pathname, project?.name, updateTab]);

  // Get workspace color for Desk tab (when on workspace-scoped page)
  const deskWorkspaceColor = isWorkspaceScopedPage(pathname)
    ? currentWorkspace?.color
    : undefined;

  const handleActivate = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
    },
    [setActiveTab]
  );

  // Close tab with dirty check
  const handleClose = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // Check if tab has unsaved changes
      if (tab.isDirty) {
        setDirtyCloseDialog({
          open: true,
          tabId,
          tabTitle: tab.title,
          mode: "close-tab",
        });
        return;
      }

      closeTab(tabId);
    },
    [tabs, closeTab]
  );

  // Handle save and close from dialog
  const handleDialogSave = useCallback(() => {
    if (dirtyCloseDialog.tabId) {
      // Request save, then close
      requestSaveAndClose(dirtyCloseDialog.tabId);
    }
    setDirtyCloseDialog({
      open: false,
      tabId: null,
      tabTitle: "",
      mode: "close-tab",
    });
  }, [dirtyCloseDialog.tabId, requestSaveAndClose]);

  // Handle discard and close from dialog
  const handleDialogDontSave = useCallback(() => {
    if (dirtyCloseDialog.tabId) {
      closeTab(dirtyCloseDialog.tabId);
    }
    setDirtyCloseDialog({
      open: false,
      tabId: null,
      tabTitle: "",
      mode: "close-tab",
    });
  }, [dirtyCloseDialog.tabId, closeTab]);

  // Handle cancel from dialog
  const handleDialogCancel = useCallback(() => {
    if (dirtyCloseDialog.mode === "close-others") {
      setCloseOthersTargetTabId(null);
    }
    setDirtyCloseDialog({
      open: false,
      tabId: null,
      tabTitle: "",
      mode: "close-tab",
    });
  }, [dirtyCloseDialog.mode]);

  const handleCloseOthers = useCallback(
    (tabId: string) => {
      // Check if any other tabs are dirty
      const otherDirtyTabs = tabs.filter(
        (t) => !t.isPinned && t.id !== tabId && t.isDirty
      );

      if (otherDirtyTabs.length > 0) {
        setCloseOthersTargetTabId(tabId);
        setDirtyCloseDialog({
          open: true,
          tabId: otherDirtyTabs[0].id,
          tabTitle: otherDirtyTabs[0].title,
          mode: "close-others",
        });
        return;
      }

      closeOtherTabs(tabId);
    },
    [tabs, closeOtherTabs]
  );

  // Continue close-others flow after each dirty tab is handled
  useEffect(() => {
    if (!closeOthersTargetTabId || dirtyCloseDialog.open || pendingSaveAndClose) return;

    // Target tab was closed while flow was active
    if (!tabs.some((t) => t.id === closeOthersTargetTabId)) {
      setCloseOthersTargetTabId(null);
      return;
    }

    const nextDirtyTab = tabs.find(
      (t) => !t.isPinned && t.id !== closeOthersTargetTabId && t.isDirty
    );

    if (nextDirtyTab) {
      setDirtyCloseDialog({
        open: true,
        tabId: nextDirtyTab.id,
        tabTitle: nextDirtyTab.title,
        mode: "close-others",
      });
      return;
    }

    closeOtherTabs(closeOthersTargetTabId);
    setCloseOthersTargetTabId(null);
  }, [
    closeOthersTargetTabId,
    dirtyCloseDialog.open,
    pendingSaveAndClose,
    tabs,
    closeOtherTabs,
  ]);

  // Check if there are other closable (non-pinned) tabs besides a given tab
  const hasOtherClosableTabs = useCallback(
    (tabId: string) => {
      return tabs.filter((t) => !t.isPinned && t.id !== tabId).length > 0;
    },
    [tabs]
  );

  const { visibleTabs, overflowTabs } = useMemo(() => {
    const maxVisible = isDesktop ? MAX_VISIBLE_DESKTOP : MAX_VISIBLE_MOBILE;
    const contentTabs = tabs.filter(
      (tab) => tab.type !== "desk" && tab.type !== "ai" && tab.type !== "agent"
    );
    if (contentTabs.length <= maxVisible) {
      return { visibleTabs: contentTabs, overflowTabs: [] };
    }

    const nextVisibleTabs = [...contentTabs.slice(0, maxVisible)];
    if (!nextVisibleTabs.some((tab) => tab.id === activeTabId)) {
      const activeTab = contentTabs.find((tab) => tab.id === activeTabId);
      const replacementIndex = [...nextVisibleTabs]
        .reverse()
        .findIndex((tab) => !tab.isPinned);

      if (activeTab && replacementIndex !== -1) {
        const normalizedIndex = nextVisibleTabs.length - 1 - replacementIndex;
        nextVisibleTabs[normalizedIndex] = activeTab;
      }
    }

    const visibleTabIds = new Set(nextVisibleTabs.map((tab) => tab.id));
    const nextOverflowTabs = contentTabs.filter((tab) => !visibleTabIds.has(tab.id));

    return { visibleTabs: nextVisibleTabs, overflowTabs: nextOverflowTabs };
  }, [tabs, activeTabId, isDesktop]);

  const mainTabs = useMemo(() => {
    const order: TabType[] = ["desk", "ai", "agent"];
    return order
      .map((type) => tabs.find((tab) => tab.type === type))
      .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab));
  }, [tabs]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+W to close current tab
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        const activeTab = tabs.find((t) => t.id === activeTabId);
        if (activeTab && !activeTab.isPinned) {
          e.preventDefault();
          handleClose(activeTabId);
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
  }, [tabs, activeTabId, handleClose, setActiveTab]);

  // Only show tab bar if there are editor tabs open (not just Desk)
  if (tabs.length <= 1) {
    return null;
  }

  return (
    <>
      <div className="h-9 bg-muted/30 border-b border-border/50 flex items-end shrink-0">
        <div className="w-full h-full flex items-end gap-0.5 px-1 overflow-hidden">
          {mainTabs.length > 0 && (
            <>
              {mainTabs.map((tab) => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onActivate={() => handleActivate(tab.id)}
                  onClose={() => handleClose(tab.id)}
                  onMiddleClick={() => handleClose(tab.id)}
                  onCloseOthers={() => handleCloseOthers(tab.id)}
                  hasOtherClosableTabs={hasOtherClosableTabs(tab.id)}
                  workspaceColor={tab.type === "desk" ? deskWorkspaceColor : undefined}
                  showIcon
                  isMainTab
                />
              ))}
              <div className="h-5 w-px bg-border/50 mx-1 mb-1.5 shrink-0" />
            </>
          )}

          <div className="flex items-end h-full gap-0.5 min-w-0">
            {visibleTabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onActivate={() => handleActivate(tab.id)}
                onClose={() => handleClose(tab.id)}
                onMiddleClick={() => handleClose(tab.id)}
                onCloseOthers={() => handleCloseOthers(tab.id)}
                hasOtherClosableTabs={hasOtherClosableTabs(tab.id)}
                showIcon={false}
              />
            ))}
          </div>

          {overflowTabs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-8 px-2 text-xs rounded-t-md text-muted-foreground/80 hover:text-foreground hover:bg-muted/30 transition-colors shrink-0"
                  title={`${overflowTabs.length} hidden tabs`}
                >
                  +{overflowTabs.length}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64"
              >
                {overflowTabs.map((tab) => {
                  const Icon = SYSTEM_TAB_ICONS[tab.type];
                  const isSystemTab = tab.type === "desk" || tab.type === "ai" || tab.type === "agent";
                  return (
                    <DropdownMenuItem
                      key={tab.id}
                      onSelect={() => handleActivate(tab.id)}
                      className="gap-2"
                    >
                      {isSystemTab && Icon ? (
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      <span className="truncate flex-1">{tab.title}</span>
                      {tab.isDirty && (
                        <span className="text-muted-foreground/60 shrink-0 text-[10px] leading-none">
                          •
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <SaveChangesDialog
        open={dirtyCloseDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            if (dirtyCloseDialog.mode === "close-others") {
              setCloseOthersTargetTabId(null);
            }
            setDirtyCloseDialog({
              open: false,
              tabId: null,
              tabTitle: "",
              mode: "close-tab",
            });
          }
        }}
        title="Unsaved Changes"
        description={`"${dirtyCloseDialog.tabTitle}" has unsaved changes. Do you want to save before closing?`}
        onSave={handleDialogSave}
        onDontSave={handleDialogDontSave}
        onCancel={handleDialogCancel}
      />
    </>
  );
}
