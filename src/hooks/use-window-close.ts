
import { useEffect, useCallback, useState, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useTabStore } from "@/stores/tabs";
import { isTauri } from "@/lib/desk";

/**
 * Hook to handle window close requests from Tauri.
 * When the user tries to close the window (Cmd+Q, close button, etc.),
 * this hook checks for unsaved changes and shows a confirmation dialog if needed.
 *
 * @param onCloseRequested - Called when close is requested and there are dirty tabs.
 *   Should show a dialog and call confirmClose() or cancelClose() based on user choice.
 * @returns Object with confirmClose and cancelClose functions.
 */
export function useWindowClose(onCloseRequested?: (dirtyTabs: string[]) => void) {
  const [pendingClose, setPendingClose] = useState(false);

  // Store callback in ref to avoid stale closure issues
  const onCloseRequestedRef = useRef(onCloseRequested);
  useEffect(() => {
    onCloseRequestedRef.current = onCloseRequested;
  }, [onCloseRequested]);

  // Confirm close - tells Rust to proceed with window close
  const confirmClose = useCallback(async () => {
    if (!isTauri()) return;
    try {
      await invoke("confirm_close");
    } catch (error) {
      console.error("[use-window-close] Failed to confirm close:", error);
    }
  }, []);

  // Cancel close - just reset pending state
  const cancelClose = useCallback(() => {
    setPendingClose(false);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen("window-close-requested", async () => {
        // Get current tabs state (not stale closure value)
        const currentTabs = useTabStore.getState().tabs;
        const dirtyTabs = currentTabs.filter((t) => t.isDirty);

        if (dirtyTabs.length === 0) {
          // No unsaved changes, proceed with close
          try {
            await invoke("confirm_close");
          } catch (error) {
            console.error("[use-window-close] Failed to confirm close:", error);
          }
        } else {
          // Has unsaved changes, notify parent component
          setPendingClose(true);
          onCloseRequestedRef.current?.(dirtyTabs.map((t) => t.title));
        }
      });
    };

    setupListener();

    return () => {
      unlisten?.();
    };
  }, []); // No dependencies - we use refs and getState() for current values

  return {
    confirmClose,
    cancelClose,
    pendingClose,
  };
}
