"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout";
import { SetupWizard } from "@/components/setup";
import { useSettingsStore } from "@/stores/settings";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [hydrated, setHydrated] = useState(false);
  const setupCompleted = useSettingsStore((state) => state.setupCompleted);
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed);

  // Wait for hydration to avoid flash of wrong content
  useEffect(() => {
    setHydrated(true);
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
    <div className="flex h-screen bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
