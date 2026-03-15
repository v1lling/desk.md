import { useState, useEffect, useMemo, useRef } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard, NewTaskModal, TaskListView } from "@/components/tasks";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import {
  ContentExplorer,
  type ContentExplorerScope,
  type ContentExplorerRef,
} from "@/components/docs";
import { MeetingList, NewMeetingModal } from "@/components/meetings";
import {
  useProject,
  useProjectTasks,
  useProjectMeetings,
  useCurrentWorkspace,
  useViewMode,
  useOpenTab,
} from "@/stores";
import type { Task, Meeting } from "@/types";
import { Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusColors } from "@/lib/design-tokens";

type ProjectSection = "tasks" | "docs" | "meetings";

function isProjectSection(value: string | undefined): value is ProjectSection {
  return value === "tasks" || value === "docs" || value === "meetings";
}

export default function ProjectViewPage() {
  const { id: projectId, section } = useParams<{ id: string; section: string }>();
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

  if (!isProjectSection(section)) {
    return <Navigate to={`/projects/${projectId}/tasks`} replace />;
  }

  return (
    <ProjectPageClient
      projectId={projectId}
      section={section}
      openMeetingId={openMeetingId}
      navigate={navigate}
    />
  );
}

interface ProjectPageClientProps {
  projectId: string;
  section: ProjectSection;
  openMeetingId?: string | null;
  navigate: ReturnType<typeof useNavigate>;
}

function ProjectPageClient({
  projectId,
  section,
  openMeetingId,
  navigate,
}: ProjectPageClientProps) {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;

  const { data: project, isLoading: projectLoading } = useProject(
    currentWorkspaceId,
    projectId
  );
  const { data: tasks = [] } = useProjectTasks(currentWorkspaceId, projectId);
  const { data: meetings = [] } = useProjectMeetings(currentWorkspaceId, projectId);

  const { viewMode, setViewMode } = useViewMode(currentWorkspaceId, projectId, "kanban");
  const { openTask, openMeeting } = useOpenTab();

  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const contentExplorerRef = useRef<ContentExplorerRef>(null);

  useEffect(() => {
    if (openMeetingId && meetings.length > 0) {
      const meetingToOpen = meetings.find((m) => m.id === openMeetingId);
      if (meetingToOpen) {
        openMeeting(meetingToOpen);
        navigate(`/projects/${projectId}/meetings`, { replace: true });
      }
    }
  }, [openMeetingId, meetings, navigate, projectId, openMeeting]);

  const handleTaskClick = (task: Task) => {
    openTask(task);
  };

  const handleMeetingClick = (meeting: Meeting) => {
    openMeeting(meeting);
  };

  const contentScopes: ContentExplorerScope[] = useMemo(() => {
    if (!currentWorkspaceId) return [];
    return [
      {
        id: projectId,
        label: project?.name || "Docs",
        scope: "project",
        workspaceId: currentWorkspaceId,
        projectId,
      },
    ];
  }, [currentWorkspaceId, projectId, project?.name]);

  const sectionLabels: Record<ProjectSection, string> = {
    tasks: "Tasks",
    docs: "Docs",
    meetings: "Meetings",
  };

  if (projectLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-10 border-b border-border flex items-center px-4">
          <div className="animate-pulse text-muted-foreground text-sm">Loading project...</div>
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
      <header className="h-10 border-b border-border px-4 flex items-center gap-2">
        <h1 className="text-sm font-semibold">{project.name}</h1>
        <Badge
          variant="outline"
          className={cn("capitalize text-[10px] h-5", statusColors[project.status])}
        >
          {project.status}
        </Badge>
      </header>

      <div className="shrink-0 h-11 px-4 border-b border-border flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {sectionLabels[section]}
        </div>

        <div className="flex items-center gap-2">
          {section === "tasks" && (
            <>
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
              <Button size="sm" onClick={() => setShowNewTask(true)}>
                <Plus className="h-4 w-4" />
                New Task
              </Button>
            </>
          )}

          {section === "docs" && (
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
          )}

          {section === "meetings" && (
            <Button size="sm" onClick={() => setShowNewMeeting(true)}>
              <Plus className="h-4 w-4" />
              New Meeting
            </Button>
          )}
        </div>
      </div>

      {section === "tasks" && (
        <ScrollArea className="flex-1">
          <div className={viewMode === "kanban" ? "px-4 pt-2 pb-4" : "p-4"}>
            {viewMode === "kanban" ? (
              <KanbanBoard projectId={projectId} onTaskClick={handleTaskClick} />
            ) : (
              <TaskListView tasks={tasks} onTaskClick={handleTaskClick} groupByStatus />
            )}
          </div>
        </ScrollArea>
      )}

      {section === "docs" && (
        <div className="flex-1 min-h-0">
          <ContentExplorer ref={contentExplorerRef} scopes={contentScopes} hideToolbar />
        </div>
      )}

      {section === "meetings" && (
        <ScrollArea className="flex-1">
          <div className="p-4">
            <MeetingList meetings={meetings} onMeetingClick={handleMeetingClick} />
          </div>
        </ScrollArea>
      )}

      <NewTaskModal
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        defaultProjectId={projectId}
      />

      <NewMeetingModal
        open={showNewMeeting}
        onClose={() => setShowNewMeeting(false)}
        defaultProjectId={projectId}
      />
    </div>
  );
}
