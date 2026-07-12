
import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sidebar, SecondarySidebar } from "@/components/layout";
import { SetupWizard } from "@/components/setup";
import { TabBar, TabContent } from "@/components/tabs";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { useBootStore } from "@/stores/boot";
import { useSidebarResize } from "@/hooks/use-sidebar-resize";
import { useSecondarySidebarResize } from "@/hooks/use-secondary-sidebar-resize";
import { useSecondarySidebarStore } from "@/stores/secondary-sidebar";
import { needsTrafficLightPadding, isTauri } from "@desk/core";
import { openGlobalSearch } from "@/components/global-search";
import { AIConsentDialog } from "@/components/ai/ai-consent-dialog";
import { Search } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

// Hosted mode only: the auth gate (and better-auth) is lazy-loaded behind the
// build flag, so the Tauri / browser-mock bundles never include it. When the flag
// is unset this constant-folds to null and Rollup drops the dynamic import.
const HostedAuthGate = import.meta.env.VITE_DESK_HOSTED
  ? lazy(() => import("@/components/auth/hosted-auth-gate"))
  : null;

// Native hosted mode (step 3b-native): the same lazy gate for the desktop build.
// Bundling is gated on the constant `!VITE_DESK_HOSTED` (so the lean web/PWA build
// tree-shakes it out); whether it's actually shown is a runtime decision — only in a
// Tauri webview (isTauri(), true on macOS/Windows/Linux) and only when the user has
// switched to a remote backend. No build flag: the native app is self-identifying.
const NativeAuthGate = !import.meta.env.VITE_DESK_HOSTED
  ? lazy(() => import("@/components/auth/native-auth-gate"))
  : null;

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();
  const [hydrated, setHydrated] = useState(false);
  const [hasMacTrafficLights, setHasMacTrafficLights] = useState(false);
  const setupCompleted = useBootStore((state) => state.setupCompleted);
  const connectionMode = useBootStore((state) => state.connectionMode);
  const { pathname } = useLocation();

  const {
    width: sidebarWidth,
    isCollapsed,
    isDragging,
    handleResize,
    handleResizeEnd,
    handleDoubleClick,
  } = useSidebarResize();
  const RESIZE_HANDLE_WIDTH = 4; // matches ResizeHandle w-1
  const TRAFFIC_LIGHT_WIDTH = 84; // macOS window controls inset

  // Secondary sidebar slot — pages register content into this via useSecondarySidebar(),
  // keyed by route path.
  const slots = useSecondarySidebarStore((s) => s.slots);
  const slotContent = slots[pathname] ?? null;
  const hasSecondary = slotContent != null;

  const {
    width: secondaryWidth,
    isCollapsed: secondaryIsCollapsed,
    isDragging: secondaryIsDragging,
    handleResize: handleSecondaryResize,
    handleResizeEnd: handleSecondaryResizeEnd,
    handleDoubleClick: handleSecondaryDoubleClick,
    toggleCollapsed: toggleSecondaryCollapsed,
  } = useSecondarySidebarResize();

  // Wait for hydration to avoid flash of wrong content
  useEffect(() => {
    setHydrated(true);
    setHasMacTrafficLights(needsTrafficLightPadding());
  }, []);

  // Shown while hydrating and while the hosted auth gate resolves the session.
  const loadingView = (
    <div className="flex h-screen bg-background items-center justify-center">
      <div className="animate-pulse text-muted-foreground">{t("common.buttons.loading")}</div>
    </div>
  );

  // Show nothing until hydrated (prevents flash)
  if (!hydrated) {
    return loadingView;
  }

  const bodyGridTemplate = hasSecondary
    ? `${sidebarWidth}px ${RESIZE_HANDLE_WIDTH}px ${secondaryWidth}px ${RESIZE_HANDLE_WIDTH}px minmax(0,1fr)`
    : `${sidebarWidth}px ${RESIZE_HANDLE_WIDTH}px minmax(0,1fr)`;
  // Title bar uses its own static grid so tabs don't shift when a page registers a secondary sidebar.
  // On macOS the first column never shrinks below the traffic-light zone, so a collapsed
  // sidebar can't let the window controls overflow into the tabs.
  const titleBarFirstCol = hasMacTrafficLights
    ? Math.max(sidebarWidth, TRAFFIC_LIGHT_WIDTH)
    : sidebarWidth;
  const titleBarGridTemplate = `${titleBarFirstCol}px ${RESIZE_HANDLE_WIDTH}px minmax(0,1fr)`;

  const shell = (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <div
        className="h-10 shrink-0 border-b border-border/80 bg-muted/15 grid"
        style={{ gridTemplateColumns: titleBarGridTemplate }}
      >
        <div className="h-full relative flex items-center overflow-hidden">
          {hasMacTrafficLights && (
            <div
              data-tauri-drag-region
              className="absolute inset-y-0 left-0"
              style={{ width: TRAFFIC_LIGHT_WIDTH }}
            />
          )}
          <div data-tauri-drag-region className="flex-1 h-full" />
          {!isCollapsed && (
            <button
              type="button"
              onClick={openGlobalSearch}
              title={t("tooltips.appShell.search")}
              className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div data-tauri-drag-region className="h-full" />
        <div className="h-full min-w-0 -ml-0.5">
          <TabBar inTitleBar />
        </div>
      </div>
      <div
        className="grid flex-1 min-h-0 overflow-hidden"
        style={{ gridTemplateColumns: bodyGridTemplate }}
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
        {hasSecondary && (
          <>
            <SecondarySidebar
              width={secondaryWidth}
              isCollapsed={secondaryIsCollapsed}
              isDragging={secondaryIsDragging}
              onExpand={toggleSecondaryCollapsed}
            >
              {slotContent}
            </SecondarySidebar>
            <ResizeHandle
              onResize={handleSecondaryResize}
              onResizeEnd={handleSecondaryResizeEnd}
              onDoubleClick={handleSecondaryDoubleClick}
            />
          </>
        )}
        <main className="min-w-0 min-h-0 overflow-hidden flex flex-col">
          <TabContent>{children}</TabContent>
        </main>
      </div>
      <AIConsentDialog />
    </div>
  );

  // Hosted mode: gate the shell behind Better Auth; the local setup wizard is
  // skipped (the data root is server-side, not user-chosen on web).
  if (HostedAuthGate) {
    return (
      <Suspense fallback={loadingView}>
        <HostedAuthGate>{shell}</HostedAuthGate>
      </Suspense>
    );
  }

  // Native remote mode: the desktop app points at a server → gate behind the native
  // (bearer) auth gate. Guarded by isTauri() so the browser-mock dev build (which now
  // bundles the gate too) never shows it. Local mode falls through to the normal
  // setup-wizard path, so switching back to "This Mac" never traps the user behind a login.
  if (NativeAuthGate && isTauri() && connectionMode === "remote") {
    return (
      <Suspense fallback={loadingView}>
        <NativeAuthGate>{shell}</NativeAuthGate>
      </Suspense>
    );
  }

  // Local mode (Tauri / browser-mock): onboarding gate, then the shell.
  if (!setupCompleted) {
    return <SetupWizard />;
  }
  return shell;
}
