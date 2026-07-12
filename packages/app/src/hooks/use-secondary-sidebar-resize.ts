import { useCallback, useState } from "react";
import {
  usePreferencesStore,
  SECONDARY_SIDEBAR_COLLAPSED_WIDTH,
  SECONDARY_SIDEBAR_MIN_WIDTH,
  SECONDARY_SIDEBAR_MAX_WIDTH,
} from "@/stores/preferences";

const SNAP_TO_COLLAPSED_THRESHOLD = 120;

/**
 * Width/collapse manager for the shared secondary-sidebar slot. State is global so
 * the chrome stays the same size across routes that opt in (docs, meetings, …).
 */
export function useSecondarySidebarResize() {
  const persistedWidth = usePreferencesStore((s) => s.secondarySidebarWidth);
  const isPersistedCollapsed = usePreferencesStore((s) => s.secondarySidebarCollapsed);
  const setWidth = usePreferencesStore((s) => s.setSecondarySidebarWidth);
  const setCollapsed = usePreferencesStore((s) => s.setSecondarySidebarCollapsed);

  const [dragWidth, setDragWidth] = useState<number | null>(null);

  // While a drag is in progress, dragWidth always wins — even from a persisted-collapsed
  // state. Without this, dragging the handle out of a collapsed sidebar shows no visual
  // feedback until release. Matches `useSidebarResize` (`dragWidth ?? sidebarWidth`).
  const currentWidth =
    dragWidth ?? (isPersistedCollapsed ? SECONDARY_SIDEBAR_COLLAPSED_WIDTH : persistedWidth);
  const isCollapsed = isPersistedCollapsed && dragWidth === null;

  const handleResize = useCallback(
    (delta: number) => {
      setDragWidth((prev) => {
        const current = prev ?? (isPersistedCollapsed ? SECONDARY_SIDEBAR_COLLAPSED_WIDTH : persistedWidth);
        const next = current + delta;
        return Math.max(SECONDARY_SIDEBAR_COLLAPSED_WIDTH, Math.min(SECONDARY_SIDEBAR_MAX_WIDTH, next));
      });
    },
    [persistedWidth, isPersistedCollapsed]
  );

  const handleResizeEnd = useCallback(() => {
    if (dragWidth === null) return;
    if (dragWidth < SNAP_TO_COLLAPSED_THRESHOLD) {
      setCollapsed(true);
    } else {
      setCollapsed(false);
      const clamped = Math.max(SECONDARY_SIDEBAR_MIN_WIDTH, Math.min(dragWidth, SECONDARY_SIDEBAR_MAX_WIDTH));
      setWidth(clamped);
    }
    setDragWidth(null);
  }, [dragWidth, setWidth, setCollapsed]);

  const handleDoubleClick = useCallback(() => {
    setCollapsed(false);
    setDragWidth(null);
  }, [setCollapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!isCollapsed);
  }, [isCollapsed, setCollapsed]);

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
