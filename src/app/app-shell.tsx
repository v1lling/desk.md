"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout";
import { SetupWizard } from "@/components/setup";
import { useSettingsStore } from "@/stores/settings";
import { needsTrafficLightPadding } from "@/lib/orbit/tauri-fs";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [hydrated, setHydrated] = useState(false);
  const [hasTitleBar, setHasTitleBar] = useState(false);
  const setupCompleted = useSettingsStore((state) => state.setupCompleted);
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed);

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
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="flex-1 min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
