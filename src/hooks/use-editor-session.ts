/**
 * useEditorSession Hook
 *
 * Manages editor state for docs, tasks, and meetings.
 * Provides:
 * - Local content state with auto-save
 * - External change detection via event bus
 * - Path change and deletion handling
 *
 * This hook owns the editor state while the file is open.
 * TanStack Query is NOT used for editing - it's used for list views only.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useOpenEditorRegistry } from "@/stores/open-editor-registry";
import { subscribeToEditorEvents } from "@/stores/editor-event-bus";
import { writeTextFile, readTextFile, isTauri } from "@/lib/desk/tauri-fs";
import { parseMarkdown, serializeMarkdown } from "@/lib/desk/parser";
import type { EditorType } from "@/stores/open-editor-registry";

interface UseEditorSessionOptions {
  type: EditorType;
  entityId: string;
  filePath: string | undefined;
  initialContent: string;
  enabled: boolean;
  /** Called after successful save with the path and content that was saved */
  onSaveComplete?: (path: string, content: string) => void;
}

interface UseEditorSessionReturn {
  // Content
  content: string;
  setContent: (content: string) => void;

  // Save state
  isDirty: boolean;
  saveStatus: "idle" | "saving" | "error";

  // Path change state
  pathChanged: boolean;
  newPath: string | null;
  fileDeleted: boolean;

  // Actions
  acknowledgePathChange: () => void;
  acknowledgeDeleted: () => void;
  forceSave: () => Promise<void>;
}

const SAVE_DEBOUNCE_MS = 400; // Obsidian-like fast saves

export function useEditorSession({
  type,
  entityId,
  filePath,
  initialContent,
  enabled,
  onSaveComplete,
}: UseEditorSessionOptions): UseEditorSessionReturn {
  // Use getState() for imperative operations to avoid re-render loops
  const getRegistry = useCallback(() => useOpenEditorRegistry.getState(), []);

  const [content, setContentState] = useState(initialContent);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">(
    "idle"
  );
  const [pathChanged, setPathChanged] = useState(false);
  const [newPath, setNewPath] = useState<string | null>(null);
  const [fileDeleted, setFileDeleted] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(initialContent);
  const currentPathRef = useRef<string | undefined>(filePath);

  // Update path ref when it changes
  useEffect(() => {
    currentPathRef.current = filePath;
  }, [filePath]);

  // Reset state when initial content changes (e.g., switching to different entity)
  useEffect(() => {
    setContentState(initialContent);
    lastSavedRef.current = initialContent;
    setIsDirty(false);
    setSaveStatus("idle");
    setPathChanged(false);
    setNewPath(null);
    setFileDeleted(false);
  }, [initialContent, entityId]);

  // Register session on mount
  useEffect(() => {
    if (!enabled || !filePath) return;

    getRegistry().register(filePath, {
      type,
      entityId,
      lastSavedContent: initialContent,
    });
    lastSavedRef.current = initialContent;

    // Subscribe to events
    const unsubscribe = subscribeToEditorEvents(filePath, {
      onContentUpdate: (newContent) => {
        // External change - update editor
        setContentState(newContent);
        lastSavedRef.current = newContent;
        setIsDirty(false);
        setSaveStatus("idle");
      },
      onPathChange: (path) => {
        setPathChanged(true);
        setNewPath(path);
      },
      onDeleted: () => {
        setFileDeleted(true);
      },
    });

    return () => {
      unsubscribe();
      if (filePath) {
        getRegistry().unregister(filePath);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabled, filePath, type, entityId, initialContent, getRegistry]);

  // Save function - preserves frontmatter when saving body content
  const performSave = useCallback(
    async (contentToSave: string) => {
      const path = currentPathRef.current;
      if (!path || fileDeleted || pathChanged) return;

      // No need to save if content hasn't changed
      if (contentToSave === lastSavedRef.current) {
        setIsDirty(false);
        return;
      }

      setSaveStatus("saving");
      try {
        // In Tauri: preserve frontmatter by reading existing file, updating body, and rewriting
        // This ensures fields like title, status, ai, etc. are not lost
        let fullContent = contentToSave;
        if (isTauri()) {
          try {
            const existingContent = await readTextFile(path);
            const { data: frontmatter } = parseMarkdown<Record<string, unknown>>(existingContent);
            // Recombine existing frontmatter with new body content
            fullContent = serializeMarkdown(frontmatter, contentToSave);
          } catch {
            // File might not exist yet (new file) or read failed - just save body
            fullContent = contentToSave;
          }
        }

        await writeTextFile(path, fullContent);
        lastSavedRef.current = contentToSave;
        getRegistry().updateLastSaved(path, contentToSave);
        setIsDirty(false);
        setSaveStatus("idle");

        // Trigger post-save callback (e.g., for RAG indexing)
        // Pass the full content including frontmatter for proper indexing
        onSaveComplete?.(path, fullContent);
      } catch (error) {
        console.error("[editor-session] Save failed:", error);
        setSaveStatus("error");
      }
    },
    [getRegistry, fileDeleted, pathChanged, onSaveComplete]
  );

  // Debounced auto-save on content change
  const setContent = useCallback(
    (newContent: string) => {
      setContentState(newContent);
      setIsDirty(true);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        performSave(newContent);
      }, SAVE_DEBOUNCE_MS);
    },
    [performSave]
  );

  // Force save (for manual save or before close)
  const forceSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await performSave(content);
  }, [performSave, content]);

  // Acknowledge path change
  const acknowledgePathChange = useCallback(() => {
    if (currentPathRef.current && newPath) {
      getRegistry().acknowledgePathChange(currentPathRef.current);
      currentPathRef.current = newPath;
      setPathChanged(false);
      setNewPath(null);
    }
  }, [getRegistry, newPath]);

  // Acknowledge deletion
  const acknowledgeDeleted = useCallback(() => {
    if (currentPathRef.current) {
      getRegistry().acknowledgeDeleted(currentPathRef.current);
    }
  }, [getRegistry]);

  return {
    content,
    setContent,
    isDirty,
    saveStatus,
    pathChanged,
    newPath,
    fileDeleted,
    acknowledgePathChange,
    acknowledgeDeleted,
    forceSave,
  };
}
