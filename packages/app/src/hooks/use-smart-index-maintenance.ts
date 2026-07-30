import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getDeskService,
  readWorkspaceIndex,
  rebuildWorkspaceIndex,
  writeRebuiltWorkspaceIndex,
  type AIProviderType,
  type BuildIndexProgress,
  type BuildIndexResult,
} from "@desk/core";
import { useSmartIndex } from "@/hooks/use-smart-index";
import { useProviderConfigured } from "@/hooks/use-ai-maintenance-info";
import { useWorkspaces } from "@/stores";
import { ensureAIConsent } from "@/stores/ai-consent";
import { describeAIError } from "@/lib/ai-error";
import { isDomainRemote, isLocalDisk } from "@/lib/connection";
import { smartIndexKeys } from "@/lib/query-client";
import { writeWorkspaceIndexArtifact } from "@/lib/smart-index/artifacts";
import {
  deleteGeneratedAgentFiles,
  writePerWorkspaceAgentFiles,
  writeTopLevelAgentFiles,
} from "@/lib/smart-index/agent-files";
import {
  deriveSmartIndexOverview,
  mergeBuildIndexResults,
} from "@/lib/smart-index/model";

type LastBuildResult = BuildIndexResult & { at: string };

export function useSmartIndexMaintenance(providerType: AIProviderType) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const aiKeyConfigured = useProviderConfigured(providerType);
  const { data: indexes = {} } = useSmartIndex();
  const { data: workspaces = [] } = useWorkspaces();
  const remote = isDomainRemote();
  const canBuild = isLocalDisk() || remote;

  const [isBuilding, setIsBuilding] = useState(false);
  const [lastResult, setLastResult] = useState<LastBuildResult | null>(null);
  const [indexProgress, setIndexProgress] = useState<BuildIndexProgress | null>(null);
  const [indexResult, setIndexResult] = useState<BuildIndexResult | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const overview = deriveSmartIndexOverview(indexes, workspaces);

  const buildIndex = async () => {
    // Local providers require explicit consent before file previews leave the machine.
    // In remote mode, the server operator's configured provider is the consent boundary.
    if (!remote && aiKeyConfigured && !(await ensureAIConsent())) return;

    setIsBuilding(true);
    setIndexProgress(null);
    setIndexResult(null);

    try {
      let accumulatedResult: BuildIndexResult | null = null;

      for (const workspace of workspaces) {
        let result: BuildIndexResult;
        if (remote) {
          result = await getDeskService().rebuildSmartIndex(workspace.id);
        } else {
          // Read the pre-rebuild snapshot from disk rather than a possibly unresolved query.
          // The merge write also needs the real persisted state to detect concurrent writes.
          const existingIndex = await readWorkspaceIndex(workspace.id);
          const rebuilt = await rebuildWorkspaceIndex(
            workspace.id,
            workspace.name,
            existingIndex,
            setIndexProgress,
          );
          result = rebuilt.result;
          // Core remains the sole index writer; UI-owned artifacts are refreshed afterwards.
          await writeRebuiltWorkspaceIndex(rebuilt.index, existingIndex);
          await writeWorkspaceIndexArtifact(rebuilt.index);
          getDeskService()
            .getProjects(workspace.id)
            .then((projects) =>
              writePerWorkspaceAgentFiles(workspace.id, workspace, projects),
            )
            .catch(() => {});
        }

        accumulatedResult = mergeBuildIndexResults(accumulatedResult, result);
      }

      if (accumulatedResult) {
        setIndexResult(accumulatedResult);
        setLastResult({ ...accumulatedResult, at: new Date().toISOString() });
        toast.success(
          t("toasts.settings.indexBuilt", {
            files: accumulatedResult.totalFiles,
            workspaces: workspaces.length,
          }),
        );
        writeTopLevelAgentFiles(workspaces).catch(() => {});
      }
    } catch (error) {
      const message = describeAIError(error, t) ?? String(error);
      toast.error(t("errors.settings.indexBuildFailed", { message }));
    } finally {
      setIsBuilding(false);
      setIndexProgress(null);
      void queryClient.invalidateQueries({ queryKey: smartIndexKeys.all });
    }
  };

  const clearCatalog = async () => {
    try {
      for (const workspace of workspaces) {
        await getDeskService().clearSmartIndex(workspace.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("errors.settings.catalogClearedPartial", { message }));
      setShowClearConfirm(false);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: smartIndexKeys.all });
    setIndexResult(null);
    setLastResult(null);

    try {
      await deleteGeneratedAgentFiles(workspaces);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("errors.settings.catalogClearedPartial", { message }));
      setShowClearConfirm(false);
      return;
    }

    toast.success(t("toasts.settings.catalogCleared"));
    setShowClearConfirm(false);
  };

  return {
    ...overview,
    aiKeyConfigured,
    remote,
    canBuild,
    isBuilding,
    lastResult,
    indexProgress,
    indexResult,
    showClearConfirm,
    setShowClearConfirm,
    buildIndex,
    clearCatalog,
  };
}
