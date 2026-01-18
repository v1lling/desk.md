"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { NoteList, NoteEditor, NewNoteModal } from "@/components/notes";
import { EntityFilterBar } from "@/components/ui/entity-filter-bar";
import { useNotes, useProjects, useCurrentArea } from "@/stores";
import { FolderKanban } from "lucide-react";
import type { Note } from "@/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function NotesPage() {
  const currentArea = useCurrentArea();
  const currentAreaId = currentArea?.id || null;
  const { data: notes = [], isLoading } = useNotes(currentAreaId);
  const { data: projects = [] } = useProjects(currentAreaId);

  const [showNewNote, setShowNewNote] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [filterProject, setFilterProject] = useState<string>("all");

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
  };

  // Filter and group notes by project
  const filteredNotes = useMemo(() => {
    if (filterProject === "all") return notes;
    return notes.filter((note) => note.projectId === filterProject);
  }, [notes, filterProject]);

  // Group notes by project for display
  const groupedNotes = useMemo(() => {
    const groups: Record<string, Note[]> = {};
    filteredNotes.forEach((note) => {
      const key = note.projectId;
      if (!groups[key]) groups[key] = [];
      groups[key].push(note);
    });
    return groups;
  }, [filteredNotes]);

  const getProjectName = (projectId: string) => {
    if (projectId === "_unassigned") return "No project";
    const project = projects.find((p) => p.id === projectId);
    return project?.name || projectId;
  };

  // Prepare filter options - include "No project" for unassigned
  const projectOptions = useMemo(
    () => [
      { value: "_unassigned", label: "No project" },
      ...projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects]
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Notes"
        action={{
          label: "New Note",
          onClick: () => setShowNewNote(true),
        }}
      />

      {/* Filter Bar */}
      <EntityFilterBar
        filters={[
          {
            id: "project",
            label: "Project",
            value: filterProject,
            onChange: setFilterProject,
            options: projectOptions,
            allLabel: "All projects",
            width: "w-[200px]",
          },
        ]}
        count={filteredNotes.length}
        countLabel="notes"
      />

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">
              Loading notes...
            </div>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No notes found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filterProject !== "all"
                ? "Try selecting a different project or create a new note"
                : "Create your first note to get started"}
            </p>
          </div>
        ) : filterProject === "all" ? (
          // Grouped view when showing all
          <div className="space-y-8">
            {Object.entries(groupedNotes).map(([projectId, projectNotes]) => (
              <div key={projectId}>
                <div className="flex items-center gap-2 mb-4">
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                  {projectId === "_unassigned" ? (
                    <span className="font-medium text-muted-foreground">
                      {getProjectName(projectId)}
                    </span>
                  ) : (
                    <Link
                      href={`/projects/view?id=${projectId}`}
                      className="font-medium hover:underline"
                    >
                      {getProjectName(projectId)}
                    </Link>
                  )}
                  <Badge variant="outline" className="ml-2">
                    {projectNotes.length}
                  </Badge>
                </div>
                <NoteList notes={projectNotes} onNoteClick={handleNoteClick} />
              </div>
            ))}
          </div>
        ) : (
          // Simple list when filtered
          <NoteList notes={filteredNotes} onNoteClick={handleNoteClick} />
        )}
      </main>

      <NoteEditor
        note={selectedNote}
        open={!!selectedNote}
        onClose={() => setSelectedNote(null)}
      />

      <NewNoteModal open={showNewNote} onClose={() => setShowNewNote(false)} />
    </div>
  );
}
