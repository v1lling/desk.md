import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface InlineRenameInputProps {
  currentName: string;
  onCommit: (newName: string) => void;
  onCancel: () => void;
  className?: string;
}

export function InlineRenameInput({
  currentName,
  onCommit,
  onCancel,
  className,
}: InlineRenameInputProps) {
  const [value, setValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  const handleCommit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;

    const trimmed = value.trim();
    if (trimmed && trimmed !== currentName) {
      onCommit(trimmed);
    } else {
      onCancel();
    }
  }, [value, currentName, onCommit, onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCommit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        committedRef.current = true;
        onCancel();
      }
      // Stop propagation to prevent tree keyboard handlers
      e.stopPropagation();
    },
    [handleCommit, onCancel]
  );

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "text-sm bg-background border border-ring rounded px-1 py-0 h-5 min-w-0 outline-none",
        className
      )}
    />
  );
}
