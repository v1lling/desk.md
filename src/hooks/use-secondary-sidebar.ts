import { useEffect, type ReactNode } from "react";
import { useSecondarySidebarStore } from "@/stores/secondary-sidebar";

/**
 * Register content into the app-shell's secondary-sidebar slot for the given key.
 * The key is usually a route path ("/docs") but may be a tab-context key
 * ("assistant") for tabs that have no route. Clears the slot on unmount or when
 * the key changes.
 *
 * Callers should pass a stable `content` reference (wrap in `useMemo`) — otherwise
 * `setSlot` will fire on every render, replacing the slot content unnecessarily.
 */
export function useSecondarySidebar(key: string, content: ReactNode) {
  const setSlot = useSecondarySidebarStore((s) => s.setSlot);
  const clearSlot = useSecondarySidebarStore((s) => s.clearSlot);

  // Re-set whenever content or key changes…
  useEffect(() => {
    setSlot(key, content);
  }, [key, content, setSlot]);

  // …but only clear on key change / unmount, not on every content rebuild.
  // Otherwise the cleanup would flip `hasSecondary` false for a render when
  // content's identity changes, causing the column to flash collapsed.
  useEffect(() => {
    return () => clearSlot(key);
  }, [key, clearSlot]);
}
