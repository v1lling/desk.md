import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Bot, Home, ChevronDown, FileText, CheckSquare, Calendar, Mail, X } from "lucide-react";
import { useTabStore } from "@/stores/tabs";
import { useCurrentWorkspace } from "@/stores/workspaces";
import { useProject } from "@/stores/projects";
import { useSettingsStore } from "@/stores/settings";
import type { TabType } from "@/stores/tabs";
import { TabItem } from "./tab-item";
import { SaveChangesDialog } from "@/components/ui/save-changes-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TAB_CONTENT_WIDTH = 160; // px per content tab (w-[160px])
const TAB_MAIN_WIDTH = 140;   // px per main tab (desk, ai)
const TAB_GAP = 4;            // gap-1 between tabs
const OVERFLOW_BTN_WIDTH = 50; // approximate width of the overflow button
const SEPARATOR_WIDTH = 9;    // separator + margins

const TAB_ICONS: Record<TabType, React.ElementType> = {
  desk: Home,
  ai: Bot,
  doc: FileText,
  task: CheckSquare,
  meeting: Calendar,
  email: Mail,
};

const WORKSPACE_SCOPED_PREFIXES = ["/tasks", "/docs", "/meetings", "/projects/"];

function isWorkspaceScopedPage(pathname: string): boolean {
  return WORKSPACE_SCOPED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function getPageName(
  pathname: string,
  projectName?: string | null
): { title: string; isWorkspaceScoped: boolean } {
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

interface TabBarProps {
  inTitleBar?: boolean;
}

export function TabBar({ inTitleBar = false }: TabBarProps) {
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
  const sidebarWidth = useSettingsStore((state) => state.sidebarWidth);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);

  const [dirtyCloseDialog, setDirtyCloseDialog] = useState<{
    open: boolean;
    tabId: string | null;
    tabTitle: string;
    mode: "close-tab" | "close-others";
  }>({ open: false, tabId: null, tabTitle: "", mode: "close-tab" });
  const [closeOthersTargetTabId, setCloseOthersTargetTabId] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const projectId = pathname.startsWith("/projects/") ? (params.id ?? null) : null;
  const { data: project } = useProject(currentWorkspace?.id || null, projectId);

  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      setActiveTab("desk");
      prevPathnameRef.current = pathname;
    }
  }, [pathname, setActiveTab]);

  useEffect(() => {
    const { title } = getPageName(pathname, project?.name);
    updateTab("desk", { title });
  }, [pathname, project?.name, updateTab]);

  const deskWorkspaceColor = isWorkspaceScopedPage(pathname)
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
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

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

  const handleDialogSave = useCallback(() => {
    if (dirtyCloseDialog.tabId) {
      requestSaveAndClose(dirtyCloseDialog.tabId);
    }
    setDirtyCloseDialog({
      open: false,
      tabId: null,
      tabTitle: "",
      mode: "close-tab",
    });
  }, [dirtyCloseDialog.tabId, requestSaveAndClose]);

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

  useEffect(() => {
    if (!closeOthersTargetTabId || dirtyCloseDialog.open || pendingSaveAndClose) return;

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

  const hasOtherClosableTabs = useCallback(
    (tabId: string) => {
      return tabs.filter((t) => !t.isPinned && t.id !== tabId).length > 0;
    },
    [tabs]
  );

  const { visibleTabs, overflowTabs } = useMemo(() => {
    const containerWidth = windowWidth - sidebarWidth - 4 - 8; // 4=resize handle, 8=pr-2
    const contentTabs = tabs.filter(
      (tab) => tab.type !== "desk" && tab.type !== "ai"
    );
    // Calculate how many content tabs fit in the available width.
    // Reserve space for main tabs, separator, and overflow button.
    const mainTabCount = tabs.filter((t) => t.type === "desk" || t.type === "ai").length;
    const reserved = mainTabCount * (TAB_MAIN_WIDTH + TAB_GAP) + SEPARATOR_WIDTH + OVERFLOW_BTN_WIDTH;
    const maxVisible = Math.max(1, Math.floor((containerWidth - reserved) / (TAB_CONTENT_WIDTH + TAB_GAP)));
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
  }, [tabs, activeTabId, windowWidth, sidebarWidth]);

  const mainTabs = useMemo(() => {
    const order: TabType[] = ["desk", "ai"];
    return order
      .map((type) => tabs.find((tab) => tab.type === type))
      .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab));
  }, [tabs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        const activeTab = tabs.find((t) => t.id === activeTabId);
        if (activeTab && !activeTab.isPinned) {
          e.preventDefault();
          handleClose(activeTabId);
        }
      }

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

  if (tabs.length <= 1) {
    return inTitleBar ? <div className="h-full" /> : null;
  }

  const barClasses = inTitleBar
    ? "h-full flex items-end"
    : "h-9 bg-muted/20 border-b border-border/80 flex items-end shrink-0";

  const innerClasses = inTitleBar
    ? "w-full h-full flex items-end gap-1 pr-2 translate-y-px"
    : "w-full h-full flex items-end gap-1 px-2";

  return (
    <>
      <div className={barClasses}>
        <div className={innerClasses}>
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
            </>
          )}

          {mainTabs.length > 0 && visibleTabs.length > 0 && (
            <div className="w-px h-5 bg-border/60 shrink-0 self-center mx-0.5" />
          )}

          <div className={inTitleBar ? "flex items-end h-full gap-1 overflow-hidden shrink-0" : "flex items-end h-full gap-1 flex-1 min-w-0 overflow-hidden"}>
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
                  className="h-7 flex items-center gap-1 px-2 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-colors shrink-0 text-xs font-medium"
                  title={`${overflowTabs.length} more tabs`}
                >
                  <span>+{overflowTabs.length}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {overflowTabs.map((tab) => {
                  const Icon = TAB_ICONS[tab.type];
                  const isActive = tab.id === activeTabId;
                  return (
                    <DropdownMenuItem
                      key={tab.id}
                      onSelect={() => handleActivate(tab.id)}
                      className="gap-2 group/item"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className={`truncate flex-1 ${isActive ? "font-medium" : ""}`}>{tab.title}</span>
                      {tab.isDirty && (
                        <span className="text-muted-foreground/60 shrink-0 text-[10px] leading-none">•</span>
                      )}
                      {!tab.isPinned && (
                        <span
                          role="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClose(tab.id);
                          }}
                          className="ml-1 p-0.5 rounded opacity-0 group-hover/item:opacity-60 hover:!opacity-100 hover:bg-accent transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {inTitleBar && <div data-tauri-drag-region className="flex-1 h-full min-w-0" />}
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
