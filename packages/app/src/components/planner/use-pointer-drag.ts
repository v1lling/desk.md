/**
 * usePointerDrag — the one mouse-gesture primitive for the planner grid.
 *
 * Every planner gesture (move a block, resize a block, drag out a new block, drag a
 * task in from the rail) needs the same skeleton: listen on `document` rather than the
 * element, so the gesture survives the cursor leaving it; suppress text selection while
 * the button is down; restore everything on mouseup, on Escape, and on unmount; and
 * cancel any gesture still in flight when a new one starts.
 *
 * `onMove` does not fire until the cursor has travelled `threshold` pixels, which is what
 * separates a drag from a click. Threshold defaults to 0 because move and resize begin
 * immediately; only gestures that must also permit a plain click (drag-to-create, the
 * rail drag) pass DRAG_THRESHOLD_PX.
 */

import { useCallback, useEffect, useRef } from "react";

/** Travel before a mousedown counts as a drag rather than a stray click */
export const DRAG_THRESHOLD_PX = 4;

export interface PointerDragOptions {
  /** Pixels of travel before the gesture counts as a drag. 0 = start immediately. */
  threshold?: number;
  /**
   * Which travel counts toward the threshold. The grid's own gestures are purely
   * vertical (time), so they measure "y" — a sloppy sideways click must not draft a
   * block. A drag out of the rail is mostly horizontal, so it measures "both".
   */
  axis?: "x" | "y" | "both";
  /** `document.body` cursor for the duration of the drag (e.g. "grabbing"). */
  cursor?: string;
  /** Fires on every move once past the threshold. */
  onMove: (event: MouseEvent) => void;
  /** Fires on mouseup. `moved` is false when the threshold was never crossed — a click. */
  onEnd: (moved: boolean) => void;
  /** Fires on Escape. The gesture is abandoned; `onEnd` does not run. */
  onCancel?: () => void;
}

export function usePointerDrag() {
  const cleanupRef = useRef<(() => void) | null>(null);

  // A gesture in flight when the component unmounts would leak its document listeners.
  useEffect(() => () => cleanupRef.current?.(), []);

  return useCallback((event: React.MouseEvent, options: PointerDragOptions) => {
    const { threshold = 0, axis = "both", cursor, onMove, onEnd, onCancel } = options;

    // Abandon a gesture still in flight before starting another.
    cleanupRef.current?.();

    const startX = event.clientX;
    const startY = event.clientY;
    let moved = threshold === 0;

    const cleanup = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      cleanupRef.current = null;
    };

    const travelled = (ev: MouseEvent): number => {
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      if (axis === "x") return dx;
      if (axis === "y") return dy;
      return Math.hypot(dx, dy);
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!moved) {
        if (travelled(ev) < threshold) return;
        moved = true;
        // Only commit to drag styling once it really is a drag, so a click leaves no trace.
        if (cursor) document.body.style.cursor = cursor;
        document.body.style.userSelect = "none";
      }
      onMove(ev);
    };

    const handleMouseUp = () => {
      cleanup();
      onEnd(moved);
    };

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      cleanup();
      onCancel?.();
    };

    cleanupRef.current = cleanup;
    if (threshold === 0) {
      if (cursor) document.body.style.cursor = cursor;
      document.body.style.userSelect = "none";
    }
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);
  }, []);
}
