import { useMemo } from "react";
import { FileText } from "lucide-react";
import { useCurrentWorkspace } from "@/stores";
import { useSecondarySidebar } from "@/hooks/use-secondary-sidebar";
import { StatePanel } from "@/components/ui/state-panel";
import { DocsTreePane } from "@/components/docs/docs-tree-pane";

export default function DocsPage() {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;

  // Register the doc tree as the secondary sidebar slot for /docs.
  // The slot persists across tab switches (Desk tab ↔ doc tab) — only depends on the route.
  const pane = useMemo(
    () => (currentWorkspaceId ? <DocsTreePane workspaceId={currentWorkspaceId} /> : null),
    [currentWorkspaceId],
  );
  useSecondarySidebar("/docs", pane);

  if (!currentWorkspaceId || !currentWorkspace) {
    return (
      <div className="flex flex-col h-full">
        <StatePanel
          variant="empty"
          display="inline"
          title="Select a workspace"
          description="Choose a workspace in the sidebar to view docs."
          className="h-full"
        />
      </div>
    );
  }

  // Main pane: shown only when the Desk tab is active. Opening a doc switches to a doc tab,
  // and `TabContent` then renders the editor here instead.
  return (
    <div className="flex flex-col h-full">
      <StatePanel
        variant="empty"
        display="inline"
        icon={FileText}
        title="Select a doc"
        description="Pick a doc from the list to open it."
        className="h-full"
      />
    </div>
  );
}
