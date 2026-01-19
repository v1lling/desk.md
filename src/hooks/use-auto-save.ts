/**
 * useAutoSave Hook
 *
 * Provides debounced auto-save functionality for editors.
 * - Debounces changes (configurable delay, default 1.5s)
 * - Tracks save status: idle | saving | error (error-only UI)
 * - Handles Tauri-specific considerations
 * - Prevents saves during initial load
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { isTauri } from "@/lib/orbit/tauri-fs";

export type SaveStatus = "idle" | "saving" | "error";

interface UseAutoSaveOptions<T> {
  /** The data to auto-save */
  data: T;
  /** Function to perform the save */
  onSave: (data: T) => Promise<void>;
  /** Debounce delay in ms (default: 1500) */
  delay?: number;
  /** Whether auto-save is enabled (default: true in Tauri, false in browser) */
  enabled?: boolean;
  /** Callback when save status changes */
  onStatusChange?: (status: SaveStatus) => void;
}

interface UseAutoSaveReturn {
  /** Current save status */
  status: SaveStatus;
  /** Manually trigger a save */
  save: () => Promise<void>;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Reset dirty state (e.g., after manual save) */
  resetDirty: () => void;
}

export function useAutoSave<T>({
  data,
  onSave,
  delay = 1500,
  enabled,
  onStatusChange,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  // Default: enabled only in Tauri (desktop app)
  const isEnabled = enabled ?? isTauri();

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [isDirty, setIsDirty] = useState(false);

  // Track if this is the initial render (don't save on mount)
  const isInitialMount = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>("");
  // Ref to track enabled state for use in callbacks
  const enabledRef = useRef(isEnabled);

  // Serialize data for comparison
  const serializedData = JSON.stringify(data);

  // Keep enabledRef in sync
  useEffect(() => {
    enabledRef.current = isEnabled;
    // When disabled, clear any pending timeout immediately
    if (!isEnabled && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [isEnabled]);

  // Update status and notify
  const updateStatus = useCallback(
    (newStatus: SaveStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  // Perform the actual save
  const performSave = useCallback(async () => {
    // Check if still enabled (editor might have closed)
    if (!enabledRef.current) {
      return;
    }

    if (serializedData === lastSavedDataRef.current) {
      // No changes since last save
      return;
    }

    updateStatus("saving");

    try {
      await onSave(data);
      lastSavedDataRef.current = serializedData;
      setIsDirty(false);
      // Go straight to idle - we trust auto-save silently
      updateStatus("idle");
    } catch (error) {
      console.error("[auto-save] Save failed:", error);
      updateStatus("error");
    }
  }, [data, serializedData, onSave, updateStatus]);

  // Manual save function
  const save = useCallback(async () => {
    // Clear any pending auto-save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    await performSave();
  }, [performSave]);

  // Reset dirty state
  const resetDirty = useCallback(() => {
    setIsDirty(false);
    lastSavedDataRef.current = serializedData;
  }, [serializedData]);

  // Debounced auto-save effect
  useEffect(() => {
    // Skip initial mount - don't save when editor first opens
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedDataRef.current = serializedData;
      return;
    }

    // Skip if disabled
    if (!isEnabled) {
      return;
    }

    // Skip if no changes
    if (serializedData === lastSavedDataRef.current) {
      return;
    }

    // Mark as dirty
    setIsDirty(true);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new debounced save
    timeoutRef.current = setTimeout(() => {
      performSave();
    }, delay);

    // Cleanup on dependency change or unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [serializedData, isEnabled, delay, performSave]);

  return {
    status,
    save,
    isDirty,
    resetDirty,
  };
}

export default useAutoSave;
