
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout";
import { SetupWizard } from "@/components/setup";
import { TabBar, TabContent } from "@/components/tabs";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { useSettingsStore } from "@/stores/settings";
import { useTabStore } from "@/stores/tabs";
import { useSidebarResize } from "@/hooks/use-sidebar-resize";
import { needsTrafficLightPadding } from "@/lib/desk/tauri-fs";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [hydrated, setHydrated] = useState(false);
  const [hasMacTrafficLights, setHasMacTrafficLights] = useState(false);
  const setupCompleted = useSettingsStore((state) => state.setupCompleted);
  const tabCount = useTabStore((state) => state.tabs.length);

  const {
    width: sidebarWidth,
    isCollapsed,
    isDragging,
    handleResize,
    handleResizeEnd,
    handleDoubleClick,
    toggleCollapsed,
  } = useSidebarResize();
  const RESIZE_HANDLE_WIDTH = 4; // matches ResizeHandle w-1

  // Wait for hydration to avoid flash of wrong content
  useEffect(() => {
    setHydrated(true);
    setHasMacTrafficLights(needsTrafficLightPadding());
  }, []);

  // Show nothing until hydrated (prevents flash)
  if (!hydrated) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show setup wizard if not completed
  if (!setupCompleted) {
    return <SetupWizard />;
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <div
        className="h-10 shrink-0 border-b border-border/80 bg-muted/15 grid"
        style={{ gridTemplateColumns: `${sidebarWidth}px ${RESIZE_HANDLE_WIDTH}px minmax(0,1fr)` }}
      >
        <div className="h-full relative">
          <div data-tauri-drag-region className="h-full w-full" />
          {hasMacTrafficLights && (
            <div data-tauri-drag-region className="absolute inset-y-0 left-0 w-[84px]" />
          )}
        </div>
        <div data-tauri-drag-region className="h-full" />
        <div className="h-full min-w-0">
          {tabCount > 1 ? <TabBar inTitleBar /> : <div data-tauri-drag-region className="h-full w-full" />}
        </div>
      </div>
      <div
        className="grid flex-1 min-h-0 overflow-hidden"
        style={{ gridTemplateColumns: `${sidebarWidth}px ${RESIZE_HANDLE_WIDTH}px minmax(0,1fr)` }}
      >
        <Sidebar
          width={sidebarWidth}
          isCollapsed={isCollapsed}
          onToggle={toggleCollapsed}
          isDragging={isDragging}
        />
        <ResizeHandle
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          onDoubleClick={handleDoubleClick}
        />
        <main className="min-w-0 min-h-0 overflow-hidden flex flex-col">
          <TabContent>{children}</TabContent>
        </main>
      </div>
    </div>
  );
}
