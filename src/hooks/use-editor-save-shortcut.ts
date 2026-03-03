/**
 * Hook to handle Cmd+S keyboard shortcut and Tauri menu-save event.
 * Extracted from editor components where this 25-line pattern was duplicated 3 times.
 */
import { useEffect } from "react";

export function useEditorSaveShortcut(save: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    let unlistenMenu: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("menu-save", () => {
        save();
      }).then((unlisten) => {
        unlistenMenu = unlisten;
      });
    }).catch(() => {
      // Not in Tauri environment
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlistenMenu?.();
    };
  }, [save]);
}
