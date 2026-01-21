"use client";

import { useState, useCallback, type ReactNode, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

interface DocDropZoneProps {
  onFilesDropped: (files: File[]) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function DocDropZone({
  onFilesDropped,
  children,
  className,
  disabled = false,
}: DocDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      // Only respond to file drags
      if (e.dataTransfer.types.includes("Files")) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only reset if we're leaving the drop zone entirely
    // (not just entering a child element)
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
      if (disabled) return;

      // Set the drop effect
      e.dataTransfer.dropEffect = "copy";
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);

      // Filter to only .md files
      const mdFiles = files.filter(
        (file) =>
          file.name.endsWith(".md") ||
          file.name.endsWith(".markdown") ||
          file.name.endsWith(".txt")
      );

      if (mdFiles.length > 0) {
        onFilesDropped(mdFiles);
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

      {/* Drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-50 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="size-8" />
            <p className="text-sm font-medium">Drop files to import</p>
            <p className="text-xs text-muted-foreground">
              .md, .markdown, or .txt files
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
