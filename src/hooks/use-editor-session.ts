/**
 * useEditorSession Hook
 *
 * Manages editor state for docs, tasks, and meetings with manual save (Cmd+S).
 *
 * Features:
 * - Local content state (editor owns the body while open)
 * - Manual save via save() function
 * - getCurrentContent() for metadata operations
 * - External change detection via event bus
 * - Path change and deletion handling
 *
 * TanStack Query is NOT used for editing - it's used for list views only.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useOpenEditorRegistry } from "@/stores/open-editor-registry";
import { subscribeToEditorEvents } from "@/stores/editor-event-bus";
import { writeTextFile, readTextFile, isTauri } from "@/lib/desk/tauri-fs";
import { parseMarkdown, serializeMarkdown } from "@/lib/desk/parser";
import type { EditorType } from "@/stores/open-editor-registry";

// ═══════════════════════════════════════════════════════════════════════════
// Empty paragraph preservation
// ═══════════════════════════════════════════════════════════════════════════
// Markdown collapses multiple blank lines into one paragraph break.
// We use zero-width space as a marker to preserve empty paragraphs in the editor.

const EMPTY_PARA_MARKER = '\u200B';

/**
 * Pre-process markdown on load: convert sequences of 3+ newlines into
 * marker paragraphs so the editor preserves visual spacing.
 */
function preserveEmptyParagraphs(markdown: string): string {
  return markdown.replace(/\n{3,}/g, (match) => {
    const extra = match.length - 2; // beyond the base paragraph break (\n\n)
    const emptyCount = Math.floor(extra / 2);
    let result = '\n\n';
    for (let i = 0; i < emptyCount; i++) {
      result += EMPTY_PARA_MARKER + '\n\n';
    }
    if (extra % 2 !== 0) result += '\n';
    return result;
  });
}

/**
 * Post-process markdown on save: strip all markers for clean markdown on disk.
 */
function cleanEmptyParagraphs(markdown: string): string {
  return markdown.replaceAll(EMPTY_PARA_MARKER, '');
}

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
  /** Get current editor content (for metadata saves that need body) */
  getCurrentContent: () => string;

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
  /** Save content to disk. Returns true on success, false on failure or skip. */
  save: () => Promise<boolean>;
  acknowledgePathChange: () => void;
  /** Accept a user-initiated path change (e.g., project move). Updates path without showing banner. */
  acceptPathChange: (newPath: string) => void;
  acknowledgeDeleted: () => void;
}

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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [pathChanged, setPathChanged] = useState(false);
  const [newPath, setNewPath] = useState<string | null>(null);
  const [fileDeleted, setFileDeleted] = useState(false);

  const lastSavedRef = useRef<string>(initialContent);
  const currentPathRef = useRef<string | undefined>(filePath);
  const contentRef = useRef<string>(initialContent);

  // Update path ref when it changes
  useEffect(() => {
    currentPathRef.current = filePath;
  }, [filePath]);

  // Keep content ref in sync with state
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

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
          const processedBody = preserveEmptyParagraphs(body);
          setContentState(processedBody);       // Editor gets markers
          lastSavedRef.current = body;           // CLEAN (for dirty comparison)
          contentRef.current = processedBody;    // WITH markers (what editor has)
          // Update registry so file watcher knows our baseline content
          getRegistry().updateLastSaved(filePath!, body); // CLEAN (for watcher)
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

  // Register session on mount and subscribe to external changes
  useEffect(() => {
    if (!enabled || !filePath) return;

    getRegistry().register(filePath, { type, entityId });

    // Subscribe to external file change events
    const unsubscribe = subscribeToEditorEvents(filePath, {
      onContentUpdate: (newRawContent) => {
        // External change - parse to extract body only
        try {
          const { content: newBody } = parseMarkdown<Record<string, unknown>>(newRawContent);
          const processedBody = preserveEmptyParagraphs(newBody);
          setContentState(processedBody);          // Editor gets markers
          lastSavedRef.current = newBody;           // CLEAN
          contentRef.current = processedBody;       // WITH markers
          // Update registry with external content (now our baseline)
          getRegistry().updateLastSaved(filePath!, newBody); // CLEAN
          setIsDirty(false);
          setSaveStatus("idle");
        } catch (e) {
          console.error("[editor-session] Failed to parse external update:", e);
        }
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
    };
  }, [enabled, filePath, type, entityId, getRegistry]);

  // Get current content (for metadata saves — always clean, no markers)
  const getCurrentContent = useCallback(() => cleanEmptyParagraphs(contentRef.current), []);

  // Update content (marks dirty, does NOT auto-save)
  const setContent = useCallback((newContent: string) => {
    setContentState(newContent);
    contentRef.current = newContent;
    setIsDirty(true);
  }, []);

  // Save function - preserves frontmatter when saving body content
  // Returns true on success (including no-op when clean), false on failure.
  const save = useCallback(async (): Promise<boolean> => {
    const path = currentPathRef.current;
    if (!path || fileDeleted || pathChanged) return false;

    const contentToSave = cleanEmptyParagraphs(contentRef.current);

    // No need to save if content hasn't changed
    if (contentToSave === lastSavedRef.current) {
      setIsDirty(false);
      return true;
    }

    setSaveStatus("saving");
    try {
      // Preserve frontmatter by reading existing file, updating body, and rewriting
      let fullContent = contentToSave;
      if (isTauri()) {
        try {
          const existingContent = await readTextFile(path);
          const { data: frontmatter } = parseMarkdown<Record<string, unknown>>(existingContent);
          fullContent = serializeMarkdown(frontmatter, contentToSave);
        } catch {
          // File might not exist yet or read failed - just save body
          fullContent = contentToSave;
        }
      }

      await writeTextFile(path, fullContent);
      lastSavedRef.current = contentToSave;
      // Update registry so file watcher knows this was our save
      getRegistry().updateLastSaved(path, contentToSave);
      setIsDirty(false);
      setSaveStatus("idle");

      // Trigger post-save callback (e.g., for RAG indexing)
      onSaveComplete?.(path, fullContent);
      return true;
    } catch (error) {
      console.error("[editor-session] Save failed:", error);
      setSaveStatus("error");
      return false;
    }
  }, [getRegistry, fileDeleted, pathChanged, onSaveComplete]);

  // Acknowledge path change (external moves — shows banner first)
  const acknowledgePathChange = useCallback(() => {
    if (currentPathRef.current && newPath) {
      getRegistry().acknowledgePathChange(currentPathRef.current);
      currentPathRef.current = newPath;
      setPathChanged(false);
      setNewPath(null);
    }
  }, [getRegistry, newPath]);

  // Accept a user-initiated path change (e.g., project move) — no banner shown
  const acceptPathChange = useCallback((movedToPath: string) => {
    if (currentPathRef.current) {
      getRegistry().acknowledgePathChange(currentPathRef.current);
    }
    currentPathRef.current = movedToPath;
    setPathChanged(false);
    setNewPath(null);
  }, [getRegistry]);

  // Acknowledge deletion
  const acknowledgeDeleted = useCallback(() => {
    if (currentPathRef.current) {
      getRegistry().acknowledgeDeleted(currentPathRef.current);
    }
  }, [getRegistry]);

  return {
    content,
    setContent,
    getCurrentContent,
    isLoading,
    isDirty,
    saveStatus,
    pathChanged,
    newPath,
    fileDeleted,
    save,
    acknowledgePathChange,
    acceptPathChange,
    acknowledgeDeleted,
  };
}
