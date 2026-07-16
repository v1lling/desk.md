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
import { subscribeToEditorEvents } from "@desk/core";
import { getStorage } from "@desk/core";
import { isLocalDisk, isDomainRemote } from "@/lib/connection";
import { writeMarkdownFile, saveMarkdownBody } from "@desk/core";
import { parseMarkdown } from "@desk/core";
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
  /**
   * Hosted/web mode persistence. In Tauri the body is written straight to disk
   * via getStorage(); on the web client getStorage() is the mock BrowserProvider,
   * so the body must be persisted through the DeskService update mutation
   * instead (the server merges frontmatter). When set and not running in Tauri,
   * save() calls this with the body and expects true on success.
   */
  persistBody?: (content: string) => Promise<boolean>;
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
  /** Re-create the file from in-memory edits after an external delete. */
  recover: () => Promise<boolean>;
}

export function useEditorSession({
  type,
  entityId,
  filePath,
  initialContent,
  enabled,
  persistBody,
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
  const lastFrontmatterRef = useRef<Record<string, unknown>>({});
  const savingRef = useRef(false);
  const recoveringRef = useRef(false);

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

    if (!isLocalDisk()) {
      // Not local disk (remote or browser-mock): the content already came from the
      // domain (useDoc/useTask/useMeeting → getDeskService()), so use initialContent
      // instead of reading the local filesystem (which the guard blocks in remote).
      setContentState(initialContent);
      lastSavedRef.current = initialContent;
      contentRef.current = initialContent;
      setIsLoading(false);
      return;
    }

    // Local-disk mode: load content fresh from disk
    let cancelled = false;
    setIsLoading(true);

    async function loadContent() {
      try {
        const fileContent = await getStorage().readTextFile(filePath!);
        const { data: frontmatter, content: body } = parseMarkdown<Record<string, unknown>>(fileContent);
        if (!cancelled) {
          const processedBody = preserveEmptyParagraphs(body);
          setContentState(processedBody);       // Editor gets markers
          lastSavedRef.current = body;           // CLEAN (for dirty comparison)
          contentRef.current = processedBody;    // WITH markers (what editor has)
          lastFrontmatterRef.current = frontmatter; // Snapshot for delete-recovery
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
    // Loads from disk keyed on file identity; initialContent/getRegistry are
    // intentionally excluded (would re-load on every prop change; getRegistry is stable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, filePath, entityId]);

  // Register session on mount and subscribe to external changes
  useEffect(() => {
    if (!enabled || !filePath) return;

    getRegistry().register(filePath, { type, entityId });

    // Subscribe to external file change events
    const unsubscribe = subscribeToEditorEvents(filePath, {
      onContentUpdate: (newRawContent) => {
        // External change - parse to extract body and frontmatter
        try {
          const { data: newFrontmatter, content: newBody } = parseMarkdown<Record<string, unknown>>(newRawContent);
          const processedBody = preserveEmptyParagraphs(newBody);
          setContentState(processedBody);          // Editor gets markers
          lastSavedRef.current = newBody;           // CLEAN
          contentRef.current = processedBody;       // WITH markers
          lastFrontmatterRef.current = newFrontmatter; // Keep snapshot fresh
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
    if (savingRef.current) return false;

    const contentToSave = cleanEmptyParagraphs(contentRef.current);

    // No need to save if content hasn't changed
    if (contentToSave === lastSavedRef.current) {
      setIsDirty(false);
      return true;
    }

    savingRef.current = true;
    setSaveStatus("saving");
    try {
      // Not local disk (remote or web): the domain runs on the server (or is mocked).
      // Persist the body through the DeskService update mutation (server merges
      // frontmatter); getStorage() here is the guard/mock and must not be touched.
      //
      // Asymmetry vs the local-disk branch below: this path intentionally skips the
      // fileDeleted/pathChanged recovery the desktop save has. That's acceptable —
      // the file isn't on a user-visible disk that an external tool can delete or
      // rename out from under the editor; the server owns it.
      if (!isLocalDisk() && persistBody) {
        const ok = await persistBody(contentToSave);
        if (!ok) {
          setSaveStatus("error");
          return false;
        }
        lastSavedRef.current = contentToSave;
        getRegistry().updateLastSaved(path, contentToSave);
        setIsDirty(false);
        setSaveStatus("idle");
        return true;
      }

      if (isDomainRemote()) {
        // Remote/hosted domain but no persistBody was supplied for this editor. Writing here
        // would hit the GuardStorageProvider and throw; fail the save cleanly instead. Every
        // remote-capable editor must pass persistBody (task/doc/meeting editors do) — reaching
        // here is a wiring bug. (Browser-mock keeps writing to its mock provider below.)
        console.error("[editor-session] No persistBody in remote mode; refusing local write:", path);
        setSaveStatus("error");
        return false;
      }

      // Local disk (and browser mock): save through the core funnel, which preserves the
      // on-disk frontmatter, stamps `updated`, and publishes on the domain-write bus like
      // every other record write — the maintenance engine's trigger.
      const { frontmatter } = await saveMarkdownBody(path, contentToSave);
      lastFrontmatterRef.current = frontmatter; // Snapshot for delete-recovery
      lastSavedRef.current = contentToSave;
      // Update registry so file watcher knows this was our save
      getRegistry().updateLastSaved(path, contentToSave);
      setIsDirty(false);
      setSaveStatus("idle");

      return true;
    } catch (error) {
      console.error("[editor-session] Save failed:", error);
      setSaveStatus("error");
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [getRegistry, fileDeleted, pathChanged, persistBody]);

  // Recover: file was deleted externally but we still have unsaved edits.
  // Re-create the file at the original path with the last-known frontmatter
  // (snapshotted on load/save/external-update — any disk-only frontmatter edits
  // made between deletion and recovery are lost).
  const recover = useCallback(async (): Promise<boolean> => {
    const path = currentPathRef.current;
    if (!path || !fileDeleted) return false;
    if (recoveringRef.current) return false;

    recoveringRef.current = true;
    const contentToSave = cleanEmptyParagraphs(contentRef.current);

    try {
      await writeMarkdownFile(path, lastFrontmatterRef.current, contentToSave);
      lastSavedRef.current = contentToSave;
      const registry = getRegistry();
      registry.clearDeleted(path);
      registry.updateLastSaved(path, contentToSave);
      setFileDeleted(false);
      setIsDirty(false);
      setSaveStatus("idle");
      return true;
    } catch (e) {
      console.error("[editor-session] Recover failed:", e);
      return false;
    } finally {
      recoveringRef.current = false;
    }
  }, [fileDeleted, getRegistry]);

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
    recover,
  };
}
