
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout";
import { SetupWizard } from "@/components/setup";
import { TabBar, TabContent } from "@/components/tabs";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { useBootStore } from "@/stores/boot";
import { useTabStore } from "@/stores/tabs";
import { useSidebarResize } from "@/hooks/use-sidebar-resize";
import { needsTrafficLightPadding } from "@/lib/desk/tauri-fs";
import { Search } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [hydrated, setHydrated] = useState(false);
  const [hasMacTrafficLights, setHasMacTrafficLights] = useState(false);
  const setupCompleted = useBootStore((state) => state.setupCompleted);
  const tabCount = useTabStore((state) => state.tabs.length);

  const {
    width: sidebarWidth,
    isCollapsed,
    isDragging,
    handleResize,
    handleResizeEnd,
    handleDoubleClick,
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
        <div className="h-full relative flex items-center overflow-hidden">
          {hasMacTrafficLights && (
            <div data-tauri-drag-region className="absolute inset-y-0 left-0 w-[84px]" />
          )}
          <div data-tauri-drag-region className="flex-1 h-full" />
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => {
                document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
              }}
              title="Search (⌘K)"
              className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div data-tauri-drag-region className="h-full" />
        <div className="h-full min-w-0 -ml-0.5">
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
