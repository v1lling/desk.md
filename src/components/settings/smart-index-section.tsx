import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Loader2,
  AlertCircle,
  FileText,
  Clock,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useContextStore } from "@/stores/context";
import { useContextIndexStore } from "@/stores/context-index";
import { useWorkspaces } from "@/stores";
import { useSettingsStore } from "@/stores/settings";
import { buildWorkspaceIndex } from "@/lib/context-index/builder";
import { writeWorkspaceContextArtifact } from "@/lib/context-index/artifacts";
import type { BuildIndexProgress, BuildIndexResult } from "@/lib/context-index/types";
import { formatRelativeTime } from "./context-tab-utils";

interface SmartIndexSectionProps {
  aiProviderConfigured: boolean;
}

export function SmartIndexSection({ aiProviderConfigured }: SmartIndexSectionProps) {
  const {
    autoSummarizeOnSave,
    setAutoSummarizeOnSave,
  } = useContextStore();
  const currentWorkspaceId = useSettingsStore((s) => s.currentWorkspaceId);

  const { indexes, setIndex, isBuilding, setIsBuilding } = useContextIndexStore();
  const { data: workspaces = [] } = useWorkspaces();

  const [indexProgress, setIndexProgress] = useState<BuildIndexProgress | null>(null);
  const [indexResult, setIndexResult] = useState<BuildIndexResult | null>(null);
  const [showClearIndexConfirm, setShowClearIndexConfirm] = useState(false);

  const totalIndexFiles = Object.values(indexes).reduce((sum, idx) => sum + idx.fileCount, 0);
  const lastBuiltAt = Object.values(indexes)
    .map((idx) => idx.builtAt)
    .sort()
    .pop() ?? null;
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) || null;

  const handleBuildIndex = async () => {
    setIsBuilding(true);
    setIndexProgress(null);
    setIndexResult(null);

    try {
      let accumulatedResult: BuildIndexResult | null = null;

      for (const workspace of workspaces) {
        const existingIndex = indexes[workspace.id];
        const { index, result } = await buildWorkspaceIndex(
          workspace.id,
          workspace.name,
          existingIndex,
          setIndexProgress
        );
        setIndex(workspace.id, index);
        await writeWorkspaceContextArtifact(index);

        if (!accumulatedResult) {
          accumulatedResult = result;
        } else {
          accumulatedResult = {
            totalFiles: accumulatedResult.totalFiles + result.totalFiles,
            summarized: accumulatedResult.summarized + result.summarized,
            reused: accumulatedResult.reused + result.reused,
            excluded: accumulatedResult.excluded + result.excluded,
            errors: [...accumulatedResult.errors, ...result.errors],
          };
        }
      }

      if (accumulatedResult) {
        setIndexResult(accumulatedResult);
        toast.success(`Index built: ${accumulatedResult.totalFiles} files across ${workspaces.length} workspaces`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Index build failed: ${message}`);
    } finally {
      setIsBuilding(false);
      setIndexProgress(null);
    }
  };

  const handleClearContextIndex = () => {
    for (const workspace of workspaces) {
      useContextIndexStore.getState().removeIndex(workspace.id);
    }
    setIndexResult(null);
    toast.success("Context index cleared");
    setShowClearIndexConfirm(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catalog Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-semibold">{totalIndexFiles}</p>
                <p className="text-xs text-muted-foreground">Files indexed</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{formatRelativeTime(lastBuiltAt)}</p>
                <p className="text-xs text-muted-foreground">Last built</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBuildIndex}
                disabled={isBuilding || !aiProviderConfigured}
                title={!aiProviderConfigured ? "Configure AI provider first" : undefined}
              >
                {isBuilding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Rebuild Catalog
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowClearIndexConfirm(true)}
                disabled={totalIndexFiles === 0 || isBuilding}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Index
              </Button>
            </div>

            {indexProgress && indexProgress.phase === "summarizing" && (
              <div className="text-sm text-muted-foreground">
                Summarizing {indexProgress.currentWorkspace}...{" "}
                {indexProgress.processed}/{indexProgress.total} files
              </div>
            )}
            {indexProgress && indexProgress.phase === "collecting" && (
              <div className="text-sm text-muted-foreground">
                Collecting files...
              </div>
            )}

            {indexResult && indexResult.errors.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm font-medium text-destructive">
                    Errors ({indexResult.errors.length})
                  </span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {indexResult.errors.slice(0, 10).map((error, idx) => (
                    <p key={idx} className="text-xs text-destructive/90 font-mono break-all">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {indexResult && indexResult.errors.length === 0 && (
              <div className="text-sm text-muted-foreground">
                {indexResult.summarized} summarized, {indexResult.reused} reused
                {indexResult.excluded > 0 && `, ${indexResult.excluded} excluded`}
              </div>
            )}

            <div className="mt-2 rounded-lg border p-3 text-sm text-muted-foreground">
              <p>
                Catalog is used by assistant retrieval tools. The model decides which files to look up per turn.
              </p>
              {currentWorkspace && (
                <p className="mt-1">
                  Active workspace: <span className="text-foreground">{currentWorkspace.name}</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
        <CardTitle className="text-base">Catalog Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-summarize on save</Label>
              <p className="text-sm text-muted-foreground">
                Automatically update summaries when files change (runs in background)
              </p>
            </div>
            <Switch
              checked={autoSummarizeOnSave}
              onCheckedChange={(checked) => {
                setAutoSummarizeOnSave(checked);
                toast.success(checked ? "Auto-summarize enabled" : "Auto-summarize disabled");
              }}
            />
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showClearIndexConfirm}
        onOpenChange={setShowClearIndexConfirm}
        title="Clear Context Index"
        description="This will delete all file summaries. You'll need to rebuild the index for AI context features. This action cannot be undone."
        confirmLabel="Clear Index"
        variant="destructive"
        onConfirm={handleClearContextIndex}
      />
    </>
  );
}
