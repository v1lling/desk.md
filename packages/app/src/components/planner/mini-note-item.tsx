/**
 * MiniNoteItem — Compact note row for inside workspace blocks.
 * Follows MiniTaskItem visual pattern with muted styling to distinguish from tasks.
 */

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MiniNoteItemProps {
  note: string;
  onEdit: (newText: string) => void;
  onRemove: () => void;
}

export function MiniNoteItem({ note, onEdit, onRemove }: MiniNoteItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(note);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      onRemove();
    } else if (trimmed !== note) {
      onEdit(trimmed);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div data-no-drag>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
            if (e.key === "Escape") {
              setEditValue(note);
              setIsEditing(false);
            }
          }}
          className="w-full text-xs px-1.5 py-1 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-1.5 px-1.5 py-1 rounded text-xs",
        "hover:bg-muted/40 transition-colors cursor-pointer"
      )}
      onClick={() => {
        setEditValue(note);
        setIsEditing(true);
      }}
    >
      <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-[5px] bg-muted-foreground/30" />
      <span className="line-clamp-2 flex-1 text-muted-foreground">{note}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-muted transition-opacity"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}
