"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FileText } from "lucide-react";
import type { Note } from "@/types";

interface NoteCardProps {
  note: Note;
  onClick?: () => void;
}

export function NoteCard({ note, onClick }: NoteCardProps) {
  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-md">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{note.title}</h3>
            <p className="text-xs text-muted-foreground">{note.created}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {note.preview}
        </p>
      </CardContent>
    </Card>
  );
}
