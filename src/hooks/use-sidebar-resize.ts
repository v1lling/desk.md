import { useCallback, useState } from "react";
import {
  useSettingsStore,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from "@/stores/settings";

// Below this width, snap to collapsed
const SNAP_TO_COLLAPSED_THRESHOLD = 100;

export function useSidebarResize() {
  const sidebarWidth = useSettingsStore((state) => state.sidebarWidth);
  const setSidebarWidth = useSettingsStore((state) => state.setSidebarWidth);

  // Track width during drag (before snapping)
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  // Current display width (drag width or persisted width)
  const currentWidth = dragWidth ?? sidebarWidth;

  // Is sidebar in collapsed state?
  const isCollapsed = currentWidth <= SIDEBAR_COLLAPSED_WIDTH;

  // Handle resize delta during drag
  const handleResize = useCallback(
    (delta: number) => {
      setDragWidth((prev) => {
        const current = prev ?? sidebarWidth;
        const newWidth = current + delta;
        // Clamp during drag (allow going below min for snap detection)
        return Math.max(SIDEBAR_COLLAPSED_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, newWidth));
      });
    },
    [sidebarWidth]
  );

  // Handle resize end - apply snapping logic
  const handleResizeEnd = useCallback(() => {
    if (dragWidth === null) return;

    let finalWidth: number;

    if (dragWidth < SNAP_TO_COLLAPSED_THRESHOLD) {
      // Snap to collapsed
      finalWidth = SIDEBAR_COLLAPSED_WIDTH;
    } else if (dragWidth < SIDEBAR_MIN_WIDTH) {
      // In dead zone between collapsed and min - snap to nearest
      const distToCollapsed = dragWidth - SIDEBAR_COLLAPSED_WIDTH;
      const distToMin = SIDEBAR_MIN_WIDTH - dragWidth;
      finalWidth = distToCollapsed < distToMin ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_MIN_WIDTH;
    } else {
      // Normal range
      finalWidth = Math.min(dragWidth, SIDEBAR_MAX_WIDTH);
    }

    setSidebarWidth(finalWidth);
    setDragWidth(null);
  }, [dragWidth, setSidebarWidth]);

  // Double-click to reset to default
  const handleDoubleClick = useCallback(() => {
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    setDragWidth(null);
  }, [setSidebarWidth]);

  // Toggle between collapsed and default (for button/shortcut)
  const toggleCollapsed = useCallback(() => {
    const newWidth = isCollapsed ? SIDEBAR_DEFAULT_WIDTH : SIDEBAR_COLLAPSED_WIDTH;
    setSidebarWidth(newWidth);
  }, [isCollapsed, setSidebarWidth]);

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
