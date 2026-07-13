/**
 * Hit-testing against the planner grid's DOM.
 *
 * Two ways to ask "what is under the cursor", and they are NOT interchangeable:
 *
 *   dayAtClientX  — rect-scan over [data-day]. Used while dragging a *block*, where the
 *                   dragged block sits under the cursor, so elementFromPoint would return
 *                   the block being dragged instead of the column beneath it.
 *   blockAtPoint  — elementFromPoint. Only safe for gestures that do not drag a block
 *                   (the rail drag), and only while every drag ghost is pointer-events-none.
 */

/** Which day column is under this X? A column spans the full height, so X alone decides. */
export function dayAtClientX(clientX: number): string | null {
  const columns = document.querySelectorAll<HTMLElement>("[data-day]");
  for (const column of columns) {
    const rect = column.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right) {
      return column.dataset.day ?? null;
    }
  }
  return null;
}

/** The day column element itself, when its geometry is needed (e.g. to derive a minute). */
export function dayElementAt(date: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-day="${date}"]`);
}

/** Which block is under this point? Null when the point is over bare grid. */
export function blockAtPoint(
  clientX: number,
  clientY: number
): { day: string; blockId: string } | null {
  const element = document.elementFromPoint(clientX, clientY);
  const block = element?.closest<HTMLElement>("[data-block-id]");
  if (!block) return null;

  const day = block.closest<HTMLElement>("[data-day]")?.dataset.day;
  const blockId = block.dataset.blockId;
  if (!day || !blockId) return null;

  return { day, blockId };
}

/** The planner's scroll viewport (OverlayScrollbars renders its own inner element). */
export function getPlannerViewport(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    "[data-planner-scroll] [data-overlayscrollbars-viewport]"
  );
}
