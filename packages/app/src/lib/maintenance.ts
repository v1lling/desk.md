/**
 * App-side wiring of the core maintenance engine (desk/maintenance).
 *
 * Started ONLY when this app owns the data (`isLocalDisk()`): in remote mode the server runs
 * the engine, and starting it here would double-run AI on the wrong host. The app adds two
 * things the server doesn't need:
 *   - a consent gate (background AI stays off until the user accepts the privacy dialog)
 *   - post-write UI glue: regenerate WORKSPACE_CONTEXT.md (a local-mode artifact) and invalidate
 *     the Smart Index query so the Settings panel re-reads the file the engine just wrote.
 *
 * State-file writes need no callback here — the Tauri watcher sees the new context file and
 * the query invalidator's `context` case refreshes the panel.
 */
import { startMaintenanceEngine, readWorkspaceIndex } from "@desk/core";
import { isLocalDisk } from "@/lib/connection";
import { queryClient, smartIndexKeys } from "@/lib/query-client";

export async function startAppMaintenanceEngine(): Promise<void> {
  if (!isLocalDisk()) return;

  const { useAISettingsStore } = await import("@/stores/ai");
  const { writeWorkspaceContextArtifact } = await import("@/lib/context-index/artifacts");

  startMaintenanceEngine({
    canRunAI: () => useAISettingsStore.getState().aiConsentGiven,
    onIndexWritten: (workspaceId) => {
      void (async () => {
        try {
          // The engine wrote .desk/index/indexes.json (local disk here); re-read this
          // workspace's entry to regenerate its artifact, then let the query re-read for the UI.
          const index = await readWorkspaceIndex(workspaceId);
          if (index) await writeWorkspaceContextArtifact(index);
          await queryClient.invalidateQueries({ queryKey: smartIndexKeys.all });
        } catch (error) {
          console.warn("[maintenance] Post-index UI glue failed:", error);
        }
      })();
    },
  });
}
