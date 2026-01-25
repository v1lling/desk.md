"use client";

import { useEffect } from "react";
import { useTabStore } from "@/stores/tabs";

/**
 * Hook to manage editor tab title and dirty state.
 * Extracts common tab management logic from all editors.
 */
export function useEditorTab(tabId: string, title: string, isDirty: boolean) {
  const updateTab = useTabStore((state) => state.updateTab);
  const setTabDirty = useTabStore((state) => state.setTabDirty);

  // Update tab title when it changes
  useEffect(() => {
    if (title) {
      updateTab(tabId, { title });
    }
  }, [title, tabId, updateTab]);

  // Update tab dirty state
  useEffect(() => {
    setTabDirty(tabId, isDirty);
  }, [isDirty, tabId, setTabDirty]);

  return { updateTab, setTabDirty };
}
