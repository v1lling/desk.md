"use client";

import { useState } from "react";
import { Header } from "@/components/layout";
import { KanbanBoard, TaskDetailPanel, QuickAddTask } from "@/components/tasks";
import { NoteList, NoteEditor, NewNoteModal } from "@/components/notes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjectTasks, useProjectNotes, useCurrentArea } from "@/stores";
import type { Task, Note } from "@/types";
import { CheckSquare, FileText } from "lucide-react";

export default function UnassignedPage() {
  const currentArea = useCurrentArea();
  const currentAreaId = currentArea?.id || null;
  const { data: tasks = [] } = useProjectTasks(currentAreaId, "_unassigned");
  const { data: notes = [] } = useProjectNotes(currentAreaId, "_unassigned");

  const [activeTab, setActiveTab] = useState<"tasks" | "notes">("tasks");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Unassigned"
        action={{
          label: activeTab === "tasks" ? "New Task" : "New Note",
          onClick: () => activeTab === "tasks" ? setShowNewTask(true) : setShowNewNote(true),
        }}
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "tasks" | "notes")} className="flex-1 flex flex-col">
        <div className="px-6 pt-4 border-b">
          <TabsList>
            <TabsTrigger value="tasks" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              Tasks
              {tasks.length > 0 && (
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {tasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <FileText className="h-4 w-4" />
              Notes
              {notes.length > 0 && (
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {notes.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tasks" className="flex-1 p-6 overflow-hidden mt-0">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <CheckSquare className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">No unassigned tasks</p>
              <p className="text-sm">Tasks created without a project will appear here</p>
            </div>
          ) : (
            <KanbanBoard
              onTaskClick={handleTaskClick}
              tasks={tasks}
            />
          )}
        </TabsContent>

        <TabsContent value="notes" className="flex-1 p-6 overflow-auto mt-0">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">No unassigned notes</p>
              <p className="text-sm">Notes created without a project will appear here</p>
            </div>
          ) : (
            <NoteList
              notes={notes}
              onNoteClick={handleNoteClick}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />

      {/* Note Editor */}
      <NoteEditor
        note={selectedNote}
        open={!!selectedNote}
        onClose={() => setSelectedNote(null)}
      />

      {/* Quick Add Task Modal */}
      <QuickAddTask
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        defaultProjectId="_unassigned"
      />

      {/* New Note Modal */}
      <NewNoteModal
        open={showNewNote}
        onClose={() => setShowNewNote(false)}
        defaultProjectId="_unassigned"
      />
    </div>
  );
}
