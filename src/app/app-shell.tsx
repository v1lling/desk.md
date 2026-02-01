"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout";
import { SetupWizard } from "@/components/setup";
import { TabBar, TabContent } from "@/components/tabs";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { useSettingsStore } from "@/stores/settings";
import { useOpenTab } from "@/stores/tabs";
import { useSidebarResize } from "@/hooks/use-sidebar-resize";
import { needsTrafficLightPadding } from "@/lib/desk/tauri-fs";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [hydrated, setHydrated] = useState(false);
  const [hasTitleBar, setHasTitleBar] = useState(false);
  const setupCompleted = useSettingsStore((state) => state.setupCompleted);

  const {
    width: sidebarWidth,
    isCollapsed,
    isDragging,
    handleResize,
    handleResizeEnd,
    handleDoubleClick,
    toggleCollapsed,
  } = useSidebarResize();

  const { openAI } = useOpenTab();

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Shift+A: Open AI Chat
      if (e.key === "a" && e.metaKey && e.shiftKey) {
        e.preventDefault();
        openAI();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openAI]);

  // Wait for hydration to avoid flash of wrong content
  useEffect(() => {
    setHydrated(true);
    setHasTitleBar(needsTrafficLightPadding());
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
      {/* Window drag region - spans full width on macOS */}
      {hasTitleBar && (
        <div
          data-tauri-drag-region
          className="h-8 shrink-0 bg-sidebar border-b border-sidebar-border/50"
        />
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
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
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <TabBar />
          <TabContent>{children}</TabContent>
        </main>
      </div>
    </div>
  );
}
