"use client";

import { NoteCard } from "./note-card";
import type { Note } from "@/types";

interface NoteListProps {
  notes: Note[];
  onNoteClick?: (note: Note) => void;
}

export function NoteList({ notes, onNoteClick }: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No notes yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first note to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onClick={() => onNoteClick?.(note)}
        />
      ))}
    </div>
  );
}
