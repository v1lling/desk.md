"use client";

import { useTabStore } from "@/stores/tabs";
import { DocEditor } from "@/components/editors/doc-editor";
import { TaskEditor } from "@/components/editors/task-editor";
import { MeetingEditor } from "@/components/editors/meeting-editor";
import { cn } from "@/lib/utils";

interface TabContentProps {
  children: React.ReactNode;
}

export function TabContent({ children }: TabContentProps) {
  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const closeTab = useTabStore((state) => state.closeTab);

  return (
    <div className="flex-1 min-h-0 relative overflow-hidden">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            "absolute inset-0",
            tab.id === activeTabId ? "z-10 visible" : "z-0 invisible"
          )}
        >
          {tab.type === "orbit" ? (
            // Orbit tab shows the current page content
            <div className="h-full overflow-hidden">{children}</div>
          ) : tab.type === "doc" && tab.entityId ? (
            <DocEditor
              docId={tab.entityId}
              workspaceId={tab.workspaceId || ""}
              projectId={tab.projectId}
              onClose={() => closeTab(tab.id)}
            />
          ) : tab.type === "task" && tab.entityId ? (
            <TaskEditor
              taskId={tab.entityId}
              workspaceId={tab.workspaceId || ""}
              projectId={tab.projectId}
              onClose={() => closeTab(tab.id)}
            />
          ) : tab.type === "meeting" && tab.entityId ? (
            <MeetingEditor
              meetingId={tab.entityId}
              workspaceId={tab.workspaceId || ""}
              projectId={tab.projectId}
              onClose={() => closeTab(tab.id)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
