/**
 * Hook to handle Cmd+S keyboard shortcut and Tauri menu-save event.
 * Extracted from editor components where this 25-line pattern was duplicated 3 times.
 */
import { useEffect, useRef } from "react";

export function useEditorSaveShortcut(save: (() => void) | (() => Promise<unknown>)) {
  // Use a ref to always capture the latest save function,
  // avoiding stale closures from the async Tauri import delay
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        try {
          const result = saveRef.current?.();
          if (result && typeof (result as Promise<unknown>).catch === "function") {
            (result as Promise<unknown>).catch(() => {});
          }
        } catch {
          // save not ready yet
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    let unlistenMenu: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("menu-save", () => {
        try {
          const result = saveRef.current?.();
          if (result && typeof (result as Promise<unknown>).catch === "function") {
            (result as Promise<unknown>).catch(() => {});
          }
        } catch {
          // save not ready yet
        }
      }).then((unlisten) => {
        unlistenMenu = unlisten;
      }).catch(() => {
        // listen() fails when Tauri runtime is not available (browser mode)
      });
    }).catch(() => {
      // Not in Tauri environment
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlistenMenu?.();
    };
  }, []);
}
