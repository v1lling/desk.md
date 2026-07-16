/**
 * Hook to manage AI inclusion/exclusion state for an editor.
 * Extracted from editor components where this 20-line pattern was duplicated 3 times.
 */
import { useState, useCallback, useEffect } from "react";
import { getAiExclusionState, setAIInclusion } from "@/lib/context-index/aiignore";
import { getDeskService, readWorkspaceIndex } from "@desk/core";
import type { AiExclusionState } from "@/lib/context-index/aiignore";
import { toast } from "sonner";
import i18next from "i18next";
import { isLocalDisk } from "@/lib/connection";
import { queryClient, smartIndexKeys } from "@/lib/query-client";

export function useEditorAIInclusion(
  filePath: string | undefined,
  workspaceId: string,
  entityLabel: string
) {
  const [aiExclusionState, setAiExclusionState] = useState<AiExclusionState>({
    isExcluded: false,
    isInExcludedFolder: false,
  });

  useEffect(() => {
    if (filePath) {
      getAiExclusionState(filePath, workspaceId).then(setAiExclusionState);
    }
  }, [filePath, workspaceId]);

  const handleAIInclusionChange = useCallback(
    async (included: boolean) => {
      if (!filePath) return;
      if (aiExclusionState.isInExcludedFolder) return;
      try {
        await setAIInclusion(filePath, workspaceId, included);
        setAiExclusionState((prev) => ({ ...prev, isExcluded: !included }));
        if (!included) {
          // Through the service: in hosted mode the index lives on the server.
          await getDeskService().removeFromSmartIndex(workspaceId, filePath);
          // The exclusion must be visible immediately, everywhere the index surfaces: the
          // Settings catalog (query) and, in local mode, the on-disk WORKSPACE_CONTEXT.md —
          // an external agent must not keep reading the summary of a file the user just
          // marked sensitive. Same glue as the engine's onIndexWritten (lib/maintenance.ts).
          void queryClient.invalidateQueries({ queryKey: smartIndexKeys.all });
          if (isLocalDisk()) {
            const { writeWorkspaceContextArtifact } = await import("@/lib/context-index/artifacts");
            const index = await readWorkspaceIndex(workspaceId);
            if (index) await writeWorkspaceContextArtifact(index);
          }
        }
      } catch (error) {
        console.error(`[${entityLabel}-editor] Failed to update AI inclusion:`, error);
        toast.error(i18next.t("toasts.ai.inclusionUpdateFailed"));
      }
    },
    [filePath, workspaceId, aiExclusionState.isInExcludedFolder, entityLabel]
  );

  return { aiExclusionState, handleAIInclusionChange };
}
