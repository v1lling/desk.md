"use client";

import { NoteCard } from "./note-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Note } from "@/types";

interface NoteListProps {
  notes: Note[];
  onNoteClick?: (note: Note) => void;
}

export function NoteList({ notes, onNoteClick }: NoteListProps) {
  if (notes.length === 0) {
    return (
      <EmptyState
        title="No notes yet"
        description="Create your first note to get started"
      />
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
