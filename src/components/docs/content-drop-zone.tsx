
import { useState, useCallback, useEffect, useRef, type ReactNode, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/desk/tauri-fs";

interface ContentDropZoneProps {
  onFilesDropped: (files: File[], targetTreePath: string | null) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

// Marker attribute applied to the row element currently under the OS drag.
// CSS in docs-tree-row picks this up to render the drop highlight.
const TARGET_ATTR = "data-desk-drop-target";

// Walk up from elementFromPoint() until we find a row that opted into being a
// drop target (folder rows expose data-drop-tree-path={folder.treePath};
// doc/asset rows expose their parent's treePath). Returns null when the cursor
// is over empty space — the caller treats that as "root of tree".
function findTreePathAt(x: number, y: number): { path: string; el: HTMLElement } | null {
  let el = document.elementFromPoint(x, y) as HTMLElement | null;
  while (el) {
    if (el.dataset.dropTreePath !== undefined) {
      return { path: el.dataset.dropTreePath, el };
    }
    el = el.parentElement;
  }
  return null;
}

export function ContentDropZone({
  onFilesDropped,
  children,
  className,
  disabled = false,
}: ContentDropZoneProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  // Keep callback + disabled state in a ref so the Tauri listener can be
  // registered exactly once (mount) and still see the latest values.
  const onFilesDroppedRef = useRef(onFilesDropped);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    onFilesDroppedRef.current = onFilesDropped;
    disabledRef.current = disabled;
  });

  // Track the currently highlighted row so we can clear it cheaply on every
  // drag-over update. React state would force a re-render of the tree on each
  // mouse move; a single DOM attribute toggle is enough and keeps arborist
  // virtualization happy.
  const highlightedRef = useRef<HTMLElement | null>(null);
  const currentTreePathRef = useRef<string | null>(null);

  const clearHighlight = useCallback(() => {
    if (highlightedRef.current) {
      highlightedRef.current.removeAttribute(TARGET_ATTR);
      highlightedRef.current = null;
    }
    currentTreePathRef.current = null;
  }, []);

  // In Tauri, the native Cocoa overlay (drop_view.m) sits above the WKWebView
  // and intercepts OS drops before they reach the DOM. It emits dedicated
  // events for plain file URL drops, including cursor position in flipped
  // (DOM-aligned) coordinates so we can highlight the folder under the cursor.
  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    const unlisteners: Array<() => void> = [];

    (async () => {
      const { listen } = await import("@tauri-apps/api/event");

      const enterUn = await listen("desk-files-drag-enter", () => {
        if (!disabledRef.current) setIsDragging(true);
      });
      const leaveUn = await listen("desk-files-drag-leave", () => {
        setIsDragging(false);
        clearHighlight();
      });
      const overUn = await listen<{ x: number; y: number }>(
        "desk-files-drag-over",
        (event) => {
          if (disabledRef.current) return;
          const { x, y } = event.payload;
          const hit = findTreePathAt(x, y);
          if (hit?.path === currentTreePathRef.current && highlightedRef.current === hit.el) {
            return;
          }
          if (highlightedRef.current && highlightedRef.current !== hit?.el) {
            highlightedRef.current.removeAttribute(TARGET_ATTR);
          }
          if (hit) {
            hit.el.setAttribute(TARGET_ATTR, "true");
            highlightedRef.current = hit.el;
            currentTreePathRef.current = hit.path;
          } else {
            highlightedRef.current = null;
            currentTreePathRef.current = null;
          }
        },
      );
      const dropUn = await listen<{ paths: string[]; x: number; y: number }>(
        "desk-files-drag-drop",
        (event) => {
          setIsDragging(false);
          const { paths, x, y } = event.payload;
          // Snapshot the highlight target before clearing — the highlight
          // tracks our last over event, which is one frame stale by the time
          // the drop lands. Re-resolve from the actual drop coordinates so
          // we use the row the user actually released over.
          const hit = findTreePathAt(x, y);
          clearHighlight();
          if (disabledRef.current) return;
          if (paths.length === 0) return;
          void readPathsAsFiles(paths).then((files) => {
            if (files.length > 0) onFilesDroppedRef.current(files, hit?.path ?? null);
          });
        },
      );

      if (disposed) {
        enterUn();
        leaveUn();
        overUn();
        dropUn();
      } else {
        unlisteners.push(enterUn, leaveUn, overUn, dropUn);
      }
    })();

    return () => {
      disposed = true;
      clearHighlight();
      unlisteners.forEach((fn) => fn());
    };
  }, [clearHighlight]);

  // DOM drag-drop — used in browser dev mode (npm run dev). In Tauri, OS file
  // drops never reach the DOM because the Cocoa overlay claims them first, so
  // these handlers are inert in Tauri mode but harmless to leave attached.
  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isTauri()) return;
      if (e.dataTransfer.types.includes("Files")) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isTauri()) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (
      x <= rect.left ||
      x >= rect.right ||
      y <= rect.top ||
      y >= rect.bottom
    ) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isTauri()) return;
      e.dataTransfer.dropEffect = "copy";
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isTauri()) return;
      setIsDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        const hit = findTreePathAt(e.clientX, e.clientY);
        onFilesDropped(files, hit?.path ?? null);
      }
    },
    [disabled, onFilesDropped]
  );

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {isDragging && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex items-center justify-center gap-2 border-b border-primary/40 bg-primary/10 px-3 py-1.5 text-primary backdrop-blur-sm">
          <Upload className="size-3.5" />
          <span className="text-xs font-medium">
            {t("pages.docs.dropZone.title")}
          </span>
        </div>
      )}
    </div>
  );
}

async function readPathsAsFiles(paths: string[]): Promise<File[]> {
  const out: File[] = [];
  for (const path of paths) {
    try {
      // read_dropped_file returns tauri::ipc::Response → ArrayBuffer in JS.
      const buf = await invoke<ArrayBuffer>("read_dropped_file", { path });
      const name = path.split("/").pop() || path;
      out.push(new File([new Uint8Array(buf)], name));
    } catch (err) {
      console.error("[content-drop] failed to read", path, err);
    }
  }
  return out;
}
