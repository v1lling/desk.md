"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard, TaskDetailPanel, QuickAddTask } from "@/components/tasks";
import { NoteList, NoteEditor, NewNoteModal } from "@/components/notes";
import { MeetingList, MeetingEditor, NewMeetingModal } from "@/components/meetings";
import { useProject, useProjectTasks, useProjectNotes, useProjectMeetings, useCurrentArea } from "@/stores";
import type { Task, Note, Meeting } from "@/types";
import {
  LayoutGrid,
  FileText,
  Info,
  Plus,
  Calendar,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Users,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { statusColors, taskStatusTextColors } from "@/lib/design-tokens";
import { calculateTaskStats } from "@/lib/orbit/calculations";

interface ProjectPageClientProps {
  projectId: string;
}

export function ProjectPageClient({ projectId }: ProjectPageClientProps) {
  const currentArea = useCurrentArea();
  const currentAreaId = currentArea?.id || null;

  const { data: project, isLoading: projectLoading } = useProject(
    currentAreaId,
    projectId
  );
  const { data: tasks = [] } = useProjectTasks(currentAreaId, projectId);
  const { data: notes = [] } = useProjectNotes(currentAreaId, projectId);
  const { data: meetings = [] } = useProjectMeetings(currentAreaId, projectId);

  const [activeTab, setActiveTab] = useState("tasks");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [showNewMeeting, setShowNewMeeting] = useState(false);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
  };

  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
  };

  // Calculate task stats using extracted utility
  const taskStats = calculateTaskStats(tasks);

  if (projectLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-14 border-b border-border flex items-center px-6">
          <div className="animate-pulse text-muted-foreground">
            Loading project...
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-14 border-b border-border flex items-center px-6">
          <h1 className="text-lg font-semibold">Project Not Found</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">
            The project you&apos;re looking for doesn&apos;t exist.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Project Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-4 mb-2">
          <Link
            href="/projects"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <Badge
            variant="outline"
            className={cn("capitalize", statusColors[project.status])}
          >
            {project.status}
          </Badge>
        </div>
        {project.description && (
          <p className="text-sm text-muted-foreground ml-8">
            {project.description}
          </p>
        )}
      </header>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col"
      >
        <div className="px-6 pt-2">
          <TabsList className="h-10 w-auto">
            <TabsTrigger value="overview" className="gap-2">
              <Info className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Tasks
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {taskStats.total}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <FileText className="h-4 w-4" />
              Notes
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {notes.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="meetings" className="gap-2">
              <Users className="h-4 w-4" />
              Meetings
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {meetings.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="flex-1 p-6 mt-0">
          <div className="max-w-3xl space-y-6">
            {/* Project Info */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Project Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Created</span>
                  </div>
                  <p className="font-medium">{project.created}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Status</span>
                  </div>
                  <p className="font-medium capitalize">{project.status}</p>
                </div>
              </div>
            </div>

            {/* Task Summary */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Task Summary</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <div className={cn("flex items-center gap-2 mb-1", taskStatusTextColors.todo)}>
                    <Circle className="h-4 w-4" />
                    <span className="text-sm">To Do</span>
                  </div>
                  <p className="text-2xl font-bold">{taskStats.todo}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className={cn("flex items-center gap-2 mb-1", taskStatusTextColors.doing)}>
                    <Circle className="h-4 w-4 fill-current" />
                    <span className="text-sm">In Progress</span>
                  </div>
                  <p className="text-2xl font-bold">{taskStats.doing}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className={cn("flex items-center gap-2 mb-1", taskStatusTextColors.done)}>
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Done</span>
                  </div>
                  <p className="text-2xl font-bold">{taskStats.done}</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Quick Actions</h2>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => setShowNewTask(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Task
                </Button>
                <Button variant="outline" onClick={() => setShowNewNote(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Note
                </Button>
                <Button variant="outline" onClick={() => setShowNewMeeting(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Meeting
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="flex-1 mt-0 flex flex-col">
          <div className="px-6 py-3 flex justify-end border-b">
            <Button size="sm" onClick={() => setShowNewTask(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
          <div className="flex-1 p-6 overflow-hidden">
            <KanbanBoard projectId={projectId} onTaskClick={handleTaskClick} />
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="flex-1 mt-0 flex flex-col">
          <div className="px-6 py-3 flex justify-end border-b">
            <Button size="sm" onClick={() => setShowNewNote(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Note
            </Button>
          </div>
          <div className="flex-1 p-6 overflow-auto">
            <NoteList notes={notes} onNoteClick={handleNoteClick} />
          </div>
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="flex-1 mt-0 flex flex-col">
          <div className="px-6 py-3 flex justify-end border-b">
            <Button size="sm" onClick={() => setShowNewMeeting(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Meeting
            </Button>
          </div>
          <div className="flex-1 p-6 overflow-auto">
            <MeetingList meetings={meetings} onMeetingClick={handleMeetingClick} />
          </div>
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
        defaultProjectId={projectId}
      />

      {/* New Note Modal */}
      <NewNoteModal
        open={showNewNote}
        onClose={() => setShowNewNote(false)}
        defaultProjectId={projectId}
      />

      {/* Meeting Editor */}
      <MeetingEditor
        meeting={selectedMeeting}
        open={!!selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
      />

      {/* New Meeting Modal */}
      <NewMeetingModal
        open={showNewMeeting}
        onClose={() => setShowNewMeeting(false)}
        defaultProjectId={projectId}
      />
    </div>
  );
}
