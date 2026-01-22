"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard, TaskDetailPanel, QuickAddTask, TaskListView } from "@/components/tasks";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { DocExplorer, type DocExplorerScope } from "@/components/docs";
import { MeetingList, MeetingEditor, NewMeetingModal } from "@/components/meetings";
import {
  useProject,
  useProjectTasks,
  useProjectMeetings,
  useCurrentWorkspace,
  useViewMode,
  useProjects,
  useDocTree,
} from "@/stores";
import { isUnassigned } from "@/lib/orbit/constants";
import type { Task, Meeting } from "@/types";
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
  openMeetingId?: string | null;
}

export function ProjectPageClient({ projectId, openMeetingId }: ProjectPageClientProps) {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const router = useRouter();

  const { data: project, isLoading: projectLoading } = useProject(
    currentWorkspaceId,
    projectId
  );
  const { data: tasks = [] } = useProjectTasks(currentWorkspaceId, projectId);
  const { data: docTree = [] } = useDocTree("project", currentWorkspaceId, projectId);
  const { data: meetings = [] } = useProjectMeetings(currentWorkspaceId, projectId);
  const { data: allProjects = [] } = useProjects(currentWorkspaceId);

  // Count docs in tree
  const docCount = useMemo(() => {
    const countNodes = (nodes: typeof docTree): number => {
      let count = 0;
      for (const node of nodes) {
        if (node.type === "doc") count++;
        else if (node.type === "folder") count += countNodes(node.folder.children);
      }
      return count;
    };
    return countNodes(docTree);
  }, [docTree]);

  // View mode for tasks (kanban default for projects)
  const { viewMode, setViewMode } = useViewMode(currentWorkspaceId, projectId, "kanban");

  const [activeTab, setActiveTab] = useState("tasks");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewMeeting, setShowNewMeeting] = useState(false);

  // Handle ?meeting= query param from search navigation
  useEffect(() => {
    if (openMeetingId && meetings.length > 0) {
      const meetingToOpen = meetings.find((m) => m.id === openMeetingId);
      if (meetingToOpen) {
        setSelectedMeeting(meetingToOpen);
        setActiveTab("meetings");
        // Clear the URL param after opening
        router.replace(`/projects/view?id=${projectId}`, { scroll: false });
      }
    }
  }, [openMeetingId, meetings, router, projectId]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
  };

  // Calculate task stats using extracted utility
  const taskStats = calculateTaskStats(tasks);

  // Helper to get project name (for list view)
  const getProjectName = (taskProjectId: string) => {
    if (isUnassigned(taskProjectId)) return null;
    const p = allProjects.find((proj) => proj.id === taskProjectId);
    return p?.name || taskProjectId;
  };

  // DocExplorer scope for this project
  const docScopes: DocExplorerScope[] = useMemo(() => {
    if (!currentWorkspaceId) return [];
    return [
      {
        id: projectId,
        label: project?.name || "Docs",
        scope: "project",
        workspaceId: currentWorkspaceId,
        projectId: projectId,
      },
    ];
  }, [currentWorkspaceId, projectId, project?.name]);

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Project Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-4 mb-2">
          <Link
            href="/"
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
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
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
            <TabsTrigger value="docs" className="gap-2">
              <FileText className="h-4 w-4" />
              Docs
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {docCount}
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
        <TabsContent value="overview" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 max-w-3xl space-y-6">
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
                <Button variant="outline" onClick={() => setActiveTab("docs")}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Doc
                </Button>
                <Button variant="outline" onClick={() => setShowNewMeeting(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Meeting
                </Button>
              </div>
            </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="flex-1 mt-0 flex flex-col">
          <div className="px-6 py-3 flex justify-end items-center gap-3 border-b">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <Button size="sm" onClick={() => setShowNewTask(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className={viewMode === "kanban" ? "px-6 pt-2 pb-6" : "p-6"}>
              {viewMode === "kanban" ? (
                <KanbanBoard projectId={projectId} onTaskClick={handleTaskClick} />
              ) : (
                <TaskListView
                  tasks={tasks}
                  onTaskClick={handleTaskClick}
                  groupByStatus
                />
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Docs Tab */}
        <TabsContent value="docs" className="flex-1 mt-0 overflow-hidden">
          <DocExplorer scopes={docScopes} />
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="flex-1 mt-0 flex flex-col">
          <div className="px-6 py-3 flex justify-end border-b">
            <Button size="sm" onClick={() => setShowNewMeeting(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Meeting
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-6">
              <MeetingList meetings={meetings} onMeetingClick={handleMeetingClick} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />

      {/* Quick Add Task Modal */}
      <QuickAddTask
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
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
