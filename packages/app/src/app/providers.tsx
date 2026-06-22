import "@/i18n";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { usePreferencesStore } from "@/stores/preferences";
import { isTauri, initDeskDirectory, expandFsScope } from "@desk/core";
import { useQueryInvalidator } from "@/hooks/use-query-invalidator";
import { useSearchIndex } from "@/hooks/use-search-index";
import { useWindowClose } from "@/hooks/use-window-close";
import { useUpdateChecker } from "@/hooks/use-update-checker";
import { useContextIndexSync } from "@/hooks/use-context-index-sync";
import { useSecretHydration } from "@/hooks/use-secret-hydration";
import { useSuppressContextMenu } from "@/hooks/use-suppress-context-menu";
import { SaveChangesDialog } from "@/components/ui/save-changes-dialog";
import { Button } from "@/components/ui/button";
import { EmailDropOverlay } from "@/components/email/email-drop-overlay";
import { toast } from "sonner";

// Clean up legacy localStorage key from the old monolithic settings store
localStorage.removeItem("desk-settings");
// Clean up legacy AI usage from localStorage (now filesystem-backed)
localStorage.removeItem("desk-ai-usage");

interface ProvidersProps {
  children: React.ReactNode;
}

// Blocking error screen shown when startup initialization fails. Rendering the
// app anyway would only produce a confusing, broken state (no data folder).
function StartupError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-destructive/30 bg-card p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          {t("errors.startup.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("errors.startup.description")}
        </p>
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-left text-xs text-muted-foreground">
          {message}
        </pre>
        <p className="text-sm text-muted-foreground">
          {t("errors.startup.hint")}
        </p>
        <Button onClick={onRetry}>{t("common.buttons.retry")}</Button>
      </div>
    </div>
  );
}

// Initialize Tauri file system on startup
function TauriInitializer({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const runInit = useCallback(async () => {
    setInitError(null);
    setInitialized(false);
    if (isTauri()) {
      try {
        await expandFsScope();
        await initDeskDirectory();
      } catch (error) {
        console.error("[Desk] Failed to initialize:", error);
        setInitError(error instanceof Error ? error.message : String(error));
        return;
      }
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    void runInit();
  }, [runInit]);

  if (initError) {
    return <StartupError message={initError} onRetry={() => void runInit()} />;
  }

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

// Initialize context index sync
function ContextIndexProvider({ children }: { children: React.ReactNode }) {
  useContextIndexSync();
  return <>{children}</>;
}

function SecretHydrationProvider({ children }: { children: React.ReactNode }) {
  useSecretHydration();
  return <>{children}</>;
}

// Check for updates on launch and show toast if available
function UpdateProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { status, updateInfo, downloadAndInstall, dismiss } = useUpdateChecker();
  const dismissedUpdateVersion = usePreferencesStore((s) => s.dismissedUpdateVersion);

  useEffect(() => {
    if (
      status === "available" &&
      updateInfo &&
      updateInfo.version !== dismissedUpdateVersion
    ) {
      toast(t("updates.available", { version: updateInfo.version }), {
        description: t("updates.description"),
        action: {
          label: t("updates.updateAndRestart"),
          onClick: () => downloadAndInstall(),
        },
        cancel: {
          label: t("updates.skip"),
          onClick: () => dismiss(),
        },
        duration: 15000,
      });
    }
  }, [status, updateInfo, downloadAndInstall, dismiss, dismissedUpdateVersion, t]);

  return <>{children}</>;
}

// Handle window close with unsaved changes check
function WindowCloseProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
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
  const moreCount = tabCount > 3 ? t("unsavedChanges.more", { count: tabCount - 3 }) : "";

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
        title={t("unsavedChanges.title")}
        description={t("unsavedChanges.description", { tabs: tabNames, more: moreCount })}
        onSave={handleSave}
        onDontSave={handleDontSave}
        onCancel={handleCancel}
      />
    </>
  );
}

// Suppress the native WebView context menu outside text-editing surfaces
function ContextMenuSuppressionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useSuppressContextMenu();
  return <>{children}</>;
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = usePreferencesStore((state) => state.theme);

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
        <UpdateProvider>
          <QueryInvalidatorProvider>
            <SearchIndexProvider>
              <SecretHydrationProvider>
                <ContextIndexProvider>
                  <WindowCloseProvider>
                    <ThemeProvider>
                      <ContextMenuSuppressionProvider>
                        {children}
                        <EmailDropOverlay />
                      </ContextMenuSuppressionProvider>
                    </ThemeProvider>
                  </WindowCloseProvider>
                </ContextIndexProvider>
              </SecretHydrationProvider>
            </SearchIndexProvider>
          </QueryInvalidatorProvider>
        </UpdateProvider>
      </TauriInitializer>
    </QueryClientProvider>
  );
}
