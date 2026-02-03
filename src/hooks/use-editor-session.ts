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
  /** Fallback content for mock/browser mode. In Tauri, content is loaded from disk. */
  initialContent: string;
  enabled: boolean;
  /** Called after successful save with the path and content that was saved */
  onSaveComplete?: (path: string, content: string) => void;
}

interface UseEditorSessionReturn {
  // Content
  content: string;
  setContent: (content: string) => void;

  // Loading state (true while loading content from disk)
  isLoading: boolean;

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
  const [isLoading, setIsLoading] = useState(true);
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

  // Refs to access current values in cleanup (can't use state in cleanup)
  const contentRef = useRef<string>(initialContent);
  const isDirtyRef = useRef<boolean>(false);
  const fileDeletedRef = useRef<boolean>(false);
  const pathChangedRef = useRef<boolean>(false);

  // Update path ref when it changes
  useEffect(() => {
    currentPathRef.current = filePath;
  }, [filePath]);

  // Keep refs in sync with state (needed for cleanup access)
  useEffect(() => {
    contentRef.current = content;
  }, [content]);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);
  useEffect(() => {
    fileDeletedRef.current = fileDeleted;
  }, [fileDeleted]);
  useEffect(() => {
    pathChangedRef.current = pathChanged;
  }, [pathChanged]);

  // Load content from disk on mount (Tauri) or use fallback (browser/mock)
  useEffect(() => {
    if (!enabled || !filePath) {
      setIsLoading(false);
      return;
    }

    // Reset state for new entity
    setIsDirty(false);
    setSaveStatus("idle");
    setPathChanged(false);
    setNewPath(null);
    setFileDeleted(false);

    if (!isTauri()) {
      // Mock/browser mode: use initialContent as fallback
      setContentState(initialContent);
      lastSavedRef.current = initialContent;
      contentRef.current = initialContent;
      setIsLoading(false);
      return;
    }

    // Tauri mode: load content fresh from disk
    let cancelled = false;
    setIsLoading(true);

    async function loadContent() {
      try {
        const fileContent = await readTextFile(filePath!);
        const { content: body } = parseMarkdown<Record<string, unknown>>(fileContent);
        if (!cancelled) {
          setContentState(body);
          lastSavedRef.current = body;
          contentRef.current = body;
          // Update registry so file watcher knows our baseline content
          getRegistry().updateLastSaved(filePath!, body);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("[editor-session] Failed to load content from disk:", error);
        if (!cancelled) {
          // Fallback to initialContent on error
          setContentState(initialContent);
          lastSavedRef.current = initialContent;
          contentRef.current = initialContent;
          setIsLoading(false);
        }
      }
    }

    loadContent();

    return () => {
      cancelled = true;
    };
  }, [enabled, filePath, entityId]); // Note: intentionally not depending on initialContent

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
      onContentUpdate: (newRawContent) => {
        // External change - parse to extract body only (editor stores body, not raw file)
        try {
          const { content: newBody } =
            parseMarkdown<Record<string, unknown>>(newRawContent);
          setContentState(newBody);
          lastSavedRef.current = newBody;
        } catch (e) {
          console.error("[editor-session] Failed to parse external update:", e);
          // Fallback: treat as body (shouldn't happen for valid .md files)
          setContentState(newRawContent);
          lastSavedRef.current = newRawContent;
        }
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

      // Clear any pending debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // CRITICAL: Force save if there's unsaved content before unmount
      // This prevents data loss when user closes tab quickly after typing
      if (
        isDirtyRef.current &&
        filePath &&
        !fileDeletedRef.current &&
        !pathChangedRef.current
      ) {
        const path = currentPathRef.current || filePath;
        const contentToSave = contentRef.current;

        // Fire-and-forget save - we can't await in cleanup, but we start the save
        // The write should complete even if the component unmounts
        (async () => {
          try {
            // Preserve frontmatter when saving
            let fullContent = contentToSave;
            try {
              const existingContent = await readTextFile(path);
              const { data: frontmatter } = parseMarkdown<Record<string, unknown>>(existingContent);
              fullContent = serializeMarkdown(frontmatter, contentToSave);
            } catch {
              // File read failed - just save body
            }
            await writeTextFile(path, fullContent);
          } catch (error) {
            console.error("[editor-session] Force save on close failed:", error);
          }
        })();
      }

      if (filePath) {
        getRegistry().unregister(filePath);
      }
    };
  }, [enabled, filePath, type, entityId, getRegistry]);

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
    isLoading,
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
