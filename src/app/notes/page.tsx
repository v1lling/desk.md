"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { NoteList, NoteEditor, NewNoteModal } from "@/components/notes";
import { useNotes, useProjects } from "@/stores";
import { useSettingsStore } from "@/stores/settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FolderKanban } from "lucide-react";
import type { Note } from "@/types";
import Link from "next/link";

export default function NotesPage() {
  const currentAreaId = useSettingsStore((state) => state.currentAreaId);
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
    const project = projects.find((p) => p.id === projectId);
    return project?.name || projectId;
  };

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
      <div className="px-6 py-3 border-b flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Filter by project:</span>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filteredNotes.length} notes</Badge>
      </div>

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
                  <Link
                    href={`/projects/view?id=${projectId}`}
                    className="font-medium hover:underline"
                  >
                    {getProjectName(projectId)}
                  </Link>
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
