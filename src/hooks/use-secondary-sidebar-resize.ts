import { useCallback, useState } from "react";
import {
  usePreferencesStore,
  SECONDARY_SIDEBAR_COLLAPSED_WIDTH,
  SECONDARY_SIDEBAR_DEFAULT_WIDTH,
  SECONDARY_SIDEBAR_MIN_WIDTH,
  SECONDARY_SIDEBAR_MAX_WIDTH,
} from "@/stores/preferences";

const SNAP_TO_COLLAPSED_THRESHOLD = 120;

/**
 * Read-only width for a registered secondary-sidebar route. Returns 0 when not registered.
 * Shared between AppShell (layout) and TabBar (right-edge math) so both agree by construction.
 */
export function useSecondarySidebarReservedWidth(routeKey: string | null): number {
  const widths = usePreferencesStore((s) => s.secondarySidebarWidths);
  const collapsedMap = usePreferencesStore((s) => s.secondarySidebarCollapsed);
  if (!routeKey) return 0;
  const isCollapsed = !!collapsedMap[routeKey];
  return isCollapsed
    ? SECONDARY_SIDEBAR_COLLAPSED_WIDTH
    : (widths[routeKey] ?? SECONDARY_SIDEBAR_DEFAULT_WIDTH);
}

/**
 * Width/collapse manager for the per-route secondary sidebar.
 * Mirrors useSidebarResize but namespaced by `routeKey`.
 */
export function useSecondarySidebarResize(routeKey: string | null) {
  const widths = usePreferencesStore((state) => state.secondarySidebarWidths);
  const collapsedMap = usePreferencesStore((state) => state.secondarySidebarCollapsed);
  const setWidth = usePreferencesStore((state) => state.setSecondarySidebarWidth);
  const setCollapsed = usePreferencesStore((state) => state.setSecondarySidebarCollapsed);

  const persistedWidth: number =
    (routeKey ? widths[routeKey] : undefined) ?? SECONDARY_SIDEBAR_DEFAULT_WIDTH;
  const isPersistedCollapsed = routeKey ? !!collapsedMap[routeKey] : false;

  const [dragWidth, setDragWidth] = useState<number | null>(null);

  // While a drag is in progress, dragWidth always wins — even from a persisted-collapsed
  // state. Without this, dragging the handle out of a collapsed sidebar shows no visual
  // feedback until release. Matches `useSidebarResize` (`dragWidth ?? sidebarWidth`).
  const currentWidth =
    dragWidth ?? (isPersistedCollapsed ? SECONDARY_SIDEBAR_COLLAPSED_WIDTH : persistedWidth);
  const isCollapsed = isPersistedCollapsed && dragWidth === null;

  const handleResize = useCallback(
    (delta: number) => {
      if (!routeKey) return;
      setDragWidth((prev) => {
        // Start dragging from the currently displayed width so the first delta doesn't
        // jump from the handle position (e.g., 32px when collapsed) to persistedWidth.
        const current = prev ?? (isPersistedCollapsed ? SECONDARY_SIDEBAR_COLLAPSED_WIDTH : persistedWidth);
        const next = current + delta;
        return Math.max(SECONDARY_SIDEBAR_COLLAPSED_WIDTH, Math.min(SECONDARY_SIDEBAR_MAX_WIDTH, next));
      });
    },
    [routeKey, persistedWidth, isPersistedCollapsed]
  );

  const handleResizeEnd = useCallback(() => {
    if (!routeKey || dragWidth === null) return;

    if (dragWidth < SNAP_TO_COLLAPSED_THRESHOLD) {
      setCollapsed(routeKey, true);
      setWidth(routeKey, SECONDARY_SIDEBAR_DEFAULT_WIDTH);
    } else {
      setCollapsed(routeKey, false);
      const clamped = Math.max(SECONDARY_SIDEBAR_MIN_WIDTH, Math.min(dragWidth, SECONDARY_SIDEBAR_MAX_WIDTH));
      setWidth(routeKey, clamped);
    }
    setDragWidth(null);
  }, [routeKey, dragWidth, setWidth, setCollapsed]);

  const handleDoubleClick = useCallback(() => {
    if (!routeKey) return;
    setWidth(routeKey, SECONDARY_SIDEBAR_DEFAULT_WIDTH);
    setCollapsed(routeKey, false);
    setDragWidth(null);
  }, [routeKey, setWidth, setCollapsed]);

  const toggleCollapsed = useCallback(() => {
    if (!routeKey) return;
    setCollapsed(routeKey, !isCollapsed);
  }, [routeKey, isCollapsed, setCollapsed]);

  return {
    width: currentWidth,
    isCollapsed,
    isDragging: dragWidth !== null,
    handleResize,
    handleResizeEnd,
    handleDoubleClick,
    toggleCollapsed,
  };
}
