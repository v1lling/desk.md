/**
 * Hook to manage AI inclusion/exclusion state for an editor.
 * Extracted from editor components where this 20-line pattern was duplicated 3 times.
 */
import { useState, useCallback, useEffect } from "react";
import { getAiExclusionState, setAIInclusion } from "@/lib/rag/aiignore";
import { removeFromIndex } from "@/hooks/use-rag-indexer";
import type { AiExclusionState } from "@/lib/rag/aiignore";
import { toast } from "sonner";

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
          await removeFromIndex(filePath);
        }
      } catch (error) {
        console.error(`[${entityLabel}-editor] Failed to update AI inclusion:`, error);
        toast.error("Failed to update AI setting");
      }
    },
    [filePath, workspaceId, aiExclusionState.isInExcludedFolder, entityLabel]
  );

  return { aiExclusionState, handleAIInclusionChange };
}
