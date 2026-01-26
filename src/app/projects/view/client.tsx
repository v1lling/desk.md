"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard, QuickAddTask, TaskListView } from "@/components/tasks";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { DocExplorer, type DocExplorerScope } from "@/components/docs";
import { MeetingList, NewMeetingModal } from "@/components/meetings";
import {
  useProject,
  useProjectTasks,
  useProjectMeetings,
  useCurrentWorkspace,
  useViewMode,
  useProjects,
  useDocTree,
  useOpenTab,
} from "@/stores";
import { isUnassigned } from "@/lib/orbit/constants";
import type { Task, Meeting } from "@/types";
import {
  CheckSquare,
  FileText,
  Info,
  Plus,
  Calendar,
  CheckCircle2,
  Circle,
} from "lucide-react";
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
  const { openTask, openMeeting } = useOpenTab();

  const [activeTab, setActiveTab] = useState("tasks");
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewMeeting, setShowNewMeeting] = useState(false);

  // Handle ?meeting= query param from search navigation
  useEffect(() => {
    if (openMeetingId && meetings.length > 0) {
      const meetingToOpen = meetings.find((m) => m.id === openMeetingId);
      if (meetingToOpen) {
        openMeeting(meetingToOpen);
        // Clear the URL param after opening
        router.replace(`/projects/view?id=${projectId}`, { scroll: false });
      }
    }
  }, [openMeetingId, meetings, router, projectId, openMeeting]);

  const handleTaskClick = (task: Task) => {
    openTask(task);
  };

  const handleMeetingClick = (meeting: Meeting) => {
    openMeeting(meeting);
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
      <header className="h-12 border-b border-border px-4 flex items-center gap-3">
        <h1 className="text-base font-semibold">{project.name}</h1>
        <Badge
          variant="outline"
          className={cn("capitalize text-xs", statusColors[project.status])}
        >
          {project.status}
        </Badge>
        {project.description && (
          <p className="text-xs text-muted-foreground truncate flex-1">
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
        <div className="px-4 pt-1.5">
          <TabsList className="h-8 w-auto">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <Info className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5 text-xs">
              <CheckSquare className="h-3.5 w-3.5" />
              Tasks
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {taskStats.total}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Docs
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {docCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="meetings" className="gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              Meetings
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {meetings.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 max-w-3xl space-y-4">
            {/* Project Info */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Project Details</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-xs">Created</span>
                  </div>
                  <p className="text-sm font-medium">{project.created}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-xs">Status</span>
                  </div>
                  <p className="text-sm font-medium capitalize">{project.status}</p>
                </div>
              </div>
            </div>

            {/* Task Summary */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Task Summary</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="p-3 border rounded-lg">
                  <div className={cn("flex items-center gap-2 mb-1", taskStatusTextColors.todo)}>
                    <Circle className="h-3.5 w-3.5" />
                    <span className="text-xs">To Do</span>
                  </div>
                  <p className="text-xl font-bold">{taskStats.todo}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className={cn("flex items-center gap-2 mb-1", taskStatusTextColors.doing)}>
                    <Circle className="h-3.5 w-3.5 fill-current" />
                    <span className="text-xs">In Progress</span>
                  </div>
                  <p className="text-xl font-bold">{taskStats.doing}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className={cn("flex items-center gap-2 mb-1", taskStatusTextColors.done)}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="text-xs">Done</span>
                  </div>
                  <p className="text-xl font-bold">{taskStats.done}</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Quick Actions</h2>
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
          <div className="px-4 py-2 flex justify-end items-center gap-2 border-b">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <Button size="sm" onClick={() => setShowNewTask(true)}>
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className={viewMode === "kanban" ? "px-4 pt-2 pb-4" : "p-4"}>
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
          <div className="px-4 py-2 flex justify-end border-b">
            <Button size="sm" onClick={() => setShowNewMeeting(true)}>
              <Plus className="h-4 w-4" />
              New Meeting
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4">
              <MeetingList meetings={meetings} onMeetingClick={handleMeetingClick} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Quick Add Task Modal */}
      <QuickAddTask
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        defaultProjectId={projectId}
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
