"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "@/stores/settings";
import { isTauri, initDeskDirectory } from "@/lib/desk";
import { useQueryInvalidator } from "@/hooks/use-query-invalidator";
import { useSearchIndex } from "@/hooks/use-search-index";
import { useDeepLink } from "@/hooks/use-deep-link";
import { useWindowClose } from "@/hooks/use-window-close";
import { SaveChangesDialog } from "@/components/ui/save-changes-dialog";

interface ProvidersProps {
  children: React.ReactNode;
}

// Initialize Tauri file system on startup
function TauriInitializer({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function init() {
      if (isTauri()) {
        try {
          await initDeskDirectory();
        } catch (error) {
          console.error("[Desk] Failed to initialize:", error);
        }
      }
      setInitialized(true);
    }
    init();
  }, []);

  if (!initialized) {
    return null;
  }

  return <>{children}</>;
}

// Initialize query invalidator for live updates
function QueryInvalidatorProvider({ children }: { children: React.ReactNode }) {
  useQueryInvalidator();
  return <>{children}</>;
}

// Initialize search index
function SearchIndexProvider({ children }: { children: React.ReactNode }) {
  useSearchIndex();
  return <>{children}</>;
}

// Initialize deep link handler for email integration
function DeepLinkProvider({ children }: { children: React.ReactNode }) {
  useDeepLink();
  return <>{children}</>;
}

// Handle window close with unsaved changes check
function WindowCloseProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    dirtyTabs: string[];
  }>({ open: false, dirtyTabs: [] });

  const handleCloseRequested = useCallback((dirtyTabs: string[]) => {
    setDialogState({ open: true, dirtyTabs });
  }, []);

  const { confirmClose, cancelClose } = useWindowClose(handleCloseRequested);

  const handleSave = useCallback(() => {
    // For window close, we don't have a way to save all tabs automatically,
    // so we treat "Save" same as cancel - let user save manually
    // This matches the behavior of most apps where Cmd+Q with unsaved changes
    // shows a dialog but "Save" just cancels the quit
    setDialogState({ open: false, dirtyTabs: [] });
    cancelClose();
  }, [cancelClose]);

  const handleDontSave = useCallback(() => {
    setDialogState({ open: false, dirtyTabs: [] });
    confirmClose();
  }, [confirmClose]);

  const handleCancel = useCallback(() => {
    setDialogState({ open: false, dirtyTabs: [] });
    cancelClose();
  }, [cancelClose]);

  const tabCount = dialogState.dirtyTabs.length;
  const tabNames = dialogState.dirtyTabs.slice(0, 3).join(", ");
  const moreCount = tabCount > 3 ? ` and ${tabCount - 3} more` : "";

  return (
    <>
      {children}
      <SaveChangesDialog
        open={dialogState.open}
        onOpenChange={(open) => {
          if (!open) {
            setDialogState({ open: false, dirtyTabs: [] });
            cancelClose();
          }
        }}
        title="Unsaved Changes"
        description={`You have unsaved changes in: ${tabNames}${moreCount}. Do you want to save before quitting?`}
        onSave={handleSave}
        onDontSave={handleDontSave}
        onCancel={handleCancel}
      />
    </>
  );
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "system") {
      const systemDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      root.classList.toggle("dark", systemDark);

      // Listen for system theme changes
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        root.classList.toggle("dark", e.matches);
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      root.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  return <>{children}</>;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TauriInitializer>
        <DeepLinkProvider>
          <QueryInvalidatorProvider>
            <SearchIndexProvider>
              <WindowCloseProvider>
                <ThemeProvider>{children}</ThemeProvider>
              </WindowCloseProvider>
            </SearchIndexProvider>
          </QueryInvalidatorProvider>
        </DeepLinkProvider>
      </TauriInitializer>
    </QueryClientProvider>
  );
}
