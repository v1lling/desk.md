import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard, QuickAddTask, TaskListView } from "@/components/tasks";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { ContentExplorer, type ContentExplorerScope, type ContentExplorerRef } from "@/components/docs";
import { MeetingList, NewMeetingModal } from "@/components/meetings";
import { TabbedPage, TabsContent, type TabConfig } from "@/components/patterns";
import {
  useProject,
  useProjectTasks,
  useProjectMeetings,
  useCurrentWorkspace,
  useViewMode,
  useContentTree,
  useOpenTab,
} from "@/stores";
import type { Task, Meeting } from "@/types";
import {
  CheckSquare,
  FileText,
  Info,
  Plus,
  Calendar,
  CheckCircle2,
  Circle,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { statusColors, taskStatusTextColors } from "@/lib/design-tokens";
import { calculateTaskStats } from "@/lib/desk/calculations";

export default function ProjectViewPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const openMeetingId = searchParams.get("meeting");

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No project selected</p>
      </div>
    );
  }

  return <ProjectPageClient projectId={projectId} openMeetingId={openMeetingId} navigate={navigate} />;
}

interface ProjectPageClientProps {
  projectId: string;
  openMeetingId?: string | null;
  navigate: ReturnType<typeof useNavigate>;
}

function ProjectPageClient({ projectId, openMeetingId, navigate }: ProjectPageClientProps) {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;

  const { data: project, isLoading: projectLoading } = useProject(
    currentWorkspaceId,
    projectId
  );
  const { data: tasks = [] } = useProjectTasks(currentWorkspaceId, projectId);
  const { data: docTree = [] } = useContentTree("project", currentWorkspaceId, projectId);
  const { data: meetings = [] } = useProjectMeetings(currentWorkspaceId, projectId);
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
  const contentExplorerRef = useRef<ContentExplorerRef>(null);

  // Handle ?meeting= query param from search navigation
  useEffect(() => {
    if (openMeetingId && meetings.length > 0) {
      const meetingToOpen = meetings.find((m) => m.id === openMeetingId);
      if (meetingToOpen) {
        openMeeting(meetingToOpen);
        // Clear the URL param after opening
        navigate(`/projects/${projectId}`, { replace: true });
      }
    }
  }, [openMeetingId, meetings, navigate, projectId, openMeeting]);

  const handleTaskClick = (task: Task) => {
    openTask(task);
  };

  const handleMeetingClick = (meeting: Meeting) => {
    openMeeting(meeting);
  };

  // Calculate task stats using extracted utility
  const taskStats = calculateTaskStats(tasks);

  // ContentExplorer scope for this project
  const contentScopes: ContentExplorerScope[] = useMemo(() => {
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

  // Define tabs with their actions
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        value: "overview",
        label: "Overview",
        icon: <Info className="h-3.5 w-3.5" />,
      },
      {
        value: "tasks",
        label: "Tasks",
        icon: <CheckSquare className="h-3.5 w-3.5" />,
        badge: taskStats.total,
        actions: (
          <>
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
            <Button size="sm" onClick={() => setShowNewTask(true)}>
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          </>
        ),
      },
      {
        value: "docs",
        label: "Docs",
        icon: <FileText className="h-3.5 w-3.5" />,
        badge: docCount,
        actions: (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => contentExplorerRef.current?.triggerImport()}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button size="sm" onClick={() => contentExplorerRef.current?.triggerNewDoc()}>
              <Plus className="h-4 w-4" />
              New Doc
            </Button>
          </>
        ),
      },
      {
        value: "meetings",
        label: "Meetings",
        icon: <Calendar className="h-3.5 w-3.5" />,
        badge: meetings.length,
        actions: (
          <Button size="sm" onClick={() => setShowNewMeeting(true)}>
            <Plus className="h-4 w-4" />
            New Meeting
          </Button>
        ),
      },
    ],
    [taskStats.total, docCount, meetings.length, viewMode, setViewMode]
  );

  if (projectLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-10 border-b border-border flex items-center px-4">
          <div className="animate-pulse text-muted-foreground text-sm">
            Loading project...
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-10 border-b border-border flex items-center px-4">
          <h1 className="text-sm font-semibold">Project Not Found</h1>
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
      {/* Slim Project Header */}
      <header className="h-10 border-b border-border px-4 flex items-center gap-2">
        <h1 className="text-sm font-semibold">{project.name}</h1>
        <Badge
          variant="outline"
          className={cn("capitalize text-[10px] h-5", statusColors[project.status])}
        >
          {project.status}
        </Badge>
      </header>

      {/* TabbedPage handles tabs + actions */}
      <TabbedPage tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {/* Overview Tab */}
        <TabsContent value="overview" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 max-w-3xl space-y-4">
              {/* Project Info */}
              <div className="space-y-3">
                <h2 className="text-base font-semibold">Project Details</h2>
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
                  {project.description && (
                    <div className="p-3 border rounded-lg md:col-span-2">
                      <div className="text-xs text-muted-foreground mb-1">Description</div>
                      <p className="text-sm">{project.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Task Summary */}
              <div className="space-y-3">
                <h2 className="text-base font-semibold">Task Summary</h2>
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
                {/* Completion progress */}
                {taskStats.total > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          taskStats.done === taskStats.total
                            ? "bg-emerald-500"
                            : taskStats.done > 0
                              ? "bg-blue-500"
                              : "bg-muted-foreground/30"
                        )}
                        style={{ width: `${taskStats.total > 0 ? (taskStats.done / taskStats.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {taskStats.done} of {taskStats.total} complete
                    </span>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="flex-1 mt-0 flex flex-col overflow-hidden">
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
          <ContentExplorer ref={contentExplorerRef} scopes={contentScopes} hideToolbar />
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="flex-1 mt-0 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-4">
              <MeetingList meetings={meetings} onMeetingClick={handleMeetingClick} />
            </div>
          </ScrollArea>
        </TabsContent>
      </TabbedPage>

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
