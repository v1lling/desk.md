"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaveStatusIndicator } from "@/components/ui/save-status";
import { Trash2 } from "lucide-react";
import type { SaveStatus as SaveStatusType } from "@/hooks/use-auto-save";

interface EditorHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  placeholder?: string;
  saveStatus: SaveStatusType;
  onDelete: () => void;
}

export function EditorHeader({
  title,
  onTitleChange,
  placeholder = "Untitled",
  saveStatus,
  onDelete,
}: EditorHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-border/50 bg-background shrink-0">
      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={placeholder}
        className="text-lg font-semibold border-none shadow-none px-0 h-auto py-1 focus-visible:ring-0 bg-transparent flex-1"
      />
      <SaveStatusIndicator status={saveStatus} />
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
