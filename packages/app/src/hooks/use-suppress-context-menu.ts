/**
 * Suppress Native Context Menu Hook
 *
 * Stops the raw WebView/browser context menu (Open Link, Inspect Element, …)
 * from appearing on right-click — it looks out of place in a desktop app.
 *
 * Desk's own Radix context menus are unaffected: Radix triggers already call
 * preventDefault() themselves, and preventDefault() does not stop propagation,
 * so this catch-all listener only takes effect where nothing else handles the
 * event.
 *
 * The native menu is intentionally left intact inside text-editing surfaces
 * (the Tiptap doc editor, inputs, textareas) so right-click copy/paste,
 * spellcheck and look-up still work there.
 */

import { useEffect } from "react";

// Text-editing surfaces where the native menu stays useful.
const EDITABLE_SELECTOR =
  'input, textarea, [contenteditable="true"], .ProseMirror';

export function useSuppressContextMenu() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(EDITABLE_SELECTOR)) return;
      e.preventDefault();
    };

    // Bubble phase (not capture): Radix context-menu triggers must handle the
    // event first. Radix's composeEventHandlers skips its handler when
    // event.defaultPrevented is already set, so calling preventDefault() in the
    // capture phase would stop every Desk context menu from opening. By the
    // time this catch-all runs, Radix has already opened its menu where it
    // applies; elsewhere, nothing handled the event and we suppress it.
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);
}
