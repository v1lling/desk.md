import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { useCurrentWorkspace, useWorkspaces } from "@/stores";
import { useSecondarySidebar } from "@/hooks/use-secondary-sidebar";
import { StatePanel } from "@/components/ui/state-panel";
import { DocsTreePane } from "@/components/docs/docs-tree-pane";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

export default function DocsPage() {
  const { t } = useTranslation();
  const currentWorkspace = useCurrentWorkspace();
  const { isLoading: workspacesLoading } = useWorkspaces();
  const currentWorkspaceId = currentWorkspace?.id || null;

  // Register the doc tree as the secondary sidebar slot for /docs.
  // The slot persists across tab switches (Desk tab ↔ doc tab) — only depends on the route.
  const pane = useMemo(
    () => (currentWorkspaceId ? <DocsTreePane workspaceId={currentWorkspaceId} /> : null),
    [currentWorkspaceId],
  );
  useSecondarySidebar("/docs", pane);

  if (workspacesLoading) {
    return <LoadingSkeleton variant="page" />;
  }

  if (!currentWorkspaceId || !currentWorkspace) {
    return (
      <div className="flex flex-col h-full">
        <StatePanel
          variant="empty"
          display="inline"
          title={t("pages.docs.selectWorkspaceTitle")}
          description={t("pages.docs.selectWorkspaceDescription")}
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
        title={t("pages.docs.selectDocTitle")}
        description={t("pages.docs.selectDocDescription")}
        className="h-full"
      />
    </div>
  );
}
