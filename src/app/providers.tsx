"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useSettingsStore } from "@/stores/settings";
import { isTauri, initOrbitDirectory } from "@/lib/orbit";
import { useQueryInvalidator } from "@/hooks/use-query-invalidator";
import { useSearchIndex } from "@/hooks/use-search-index";
import { useDeepLink } from "@/hooks/use-deep-link";

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
          await initOrbitDirectory();
        } catch (error) {
          console.error("[Orbit] Failed to initialize:", error);
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
              <ThemeProvider>{children}</ThemeProvider>
            </SearchIndexProvider>
          </QueryInvalidatorProvider>
        </DeepLinkProvider>
      </TauriInitializer>
    </QueryClientProvider>
  );
}
