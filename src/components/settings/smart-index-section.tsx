import { useState } from "react";
import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { SummaryDetail } from "@/lib/context-index/constants";
import {
  Loader2,
  AlertCircle,
  FileText,
  Clock,
  RefreshCw,
  Trash2,
  Database,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { useContextStore } from "@/stores/context";
import { useContextIndexStore } from "@/stores/context-index";
import { useAISettingsStore } from "@/stores/ai";
import { ensureAIConsent } from "@/stores/ai-consent";
import { useWorkspaces } from "@/stores";
import { buildWorkspaceIndex } from "@/lib/context-index/builder";
import { writeWorkspaceContextArtifact } from "@/lib/context-index/artifacts";
import {
  writePerWorkspaceAgentFiles,
  writeTopLevelAgentFiles,
  deleteGeneratedAgentFiles,
} from "@/lib/context-index/agent-context";
import { getProjects } from "@/lib/desk/projects";
import type { BuildIndexProgress, BuildIndexResult } from "@/lib/context-index/types";
import { formatRelativeTime } from "./context-tab-utils";

export function SmartIndexSection() {
  const {
    autoSummarizeOnSave,
    setAutoSummarizeOnSave,
    summaryDetail,
    setSummaryDetail,
  } = useContextStore();

  // True when the active provider has an API key saved. Without one, the catalog
  // still builds — it just uses plain text previews instead of AI summaries.
  const aiKeyConfigured = useAISettingsStore(
    (s) => s.providerConfigured[s.providerType]
  );

  const { indexes, setIndex, isBuilding, setIsBuilding } = useContextIndexStore();
  const { data: workspaces = [] } = useWorkspaces();

  const [indexProgress, setIndexProgress] = useState<BuildIndexProgress | null>(null);
  const [indexResult, setIndexResult] = useState<BuildIndexResult | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const totalIndexFiles = Object.values(indexes).reduce((sum, idx) => sum + idx.fileCount, 0);
  const lastBuiltAt = Object.values(indexes)
    .map((idx) => idx.builtAt)
    .sort()
    .pop() ?? null;

  const handleBuildIndex = async () => {
    // Privacy gate: only when a provider key is configured does the build send
    // file previews externally. A keyless build is local-only — no consent needed.
    if (aiKeyConfigured && !(await ensureAIConsent())) return;

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
        // Refresh per-workspace agent files (project list may have changed)
        getProjects(workspace.id).then((projects) =>
          writePerWorkspaceAgentFiles(workspace.id, workspace, projects)
        ).catch(() => {});

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
        // Refresh top-level agent files
        writeTopLevelAgentFiles(workspaces).catch(() => {});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Index build failed: ${message}`);
    } finally {
      setIsBuilding(false);
      setIndexProgress(null);
    }
  };

  // Wipe everything: empty the assistant index and delete the generated
  // CLAUDE.md / AGENTS.md / GEMINI.md / WORKSPACE_CONTEXT.md files from disk.
  const handleClearCatalog = async () => {
    for (const workspace of workspaces) {
      useContextIndexStore.getState().removeIndex(workspace.id);
    }
    setIndexResult(null);
    try {
      await deleteGeneratedAgentFiles(workspaces);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Index cleared, but some agent files could not be removed: ${message}`);
      setShowClearConfirm(false);
      return;
    }
    toast.success("Catalog cleared");
    setShowClearConfirm(false);
  };

  return (
    <>
      <SettingsSection
        icon={<Database className="h-4 w-4" />}
        title="Catalog Status"
        description="Index stats, errors, and build controls"
      >
        <div className="space-y-4">
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
                disabled={isBuilding}
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
                onClick={() => setShowClearConfirm(true)}
                disabled={isBuilding}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Catalog
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

            <div className="mt-2 space-y-1 rounded-lg border p-3 text-sm text-muted-foreground">
              <p>
                One catalog, two readers: the in-app assistant queries this index
                directly, and — when any agent file is enabled (Settings → Agents)
                — the same catalog is written as Markdown alongside it so external
                agents (Claude Code, Codex, Gemini CLI) read it with no setup.
              </p>
              {!aiKeyConfigured && (
                <p>
                  No AI provider configured — summaries use plain text previews.
                  Add a key in Settings → AI for AI-generated summaries.
                </p>
              )}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={<SlidersHorizontal className="h-4 w-4" />}
        title="Catalog Settings"
        description="When summaries refresh and how much of each file is sent for summarization."
      >
        <div className="flex items-center justify-between py-3">
          <div className="space-y-0.5">
            <Label>Auto-summarize on save</Label>
            <p className="text-sm text-muted-foreground">
              Keep summaries fresh as you edit, and add new files to the catalog on first save.
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
        {autoSummarizeOnSave && aiKeyConfigured && (
          <p className="pb-3 text-xs text-amber-600 dark:text-amber-400">
            ~5 seconds after your last save, each file whose body actually changed is
            re-summarized (one API call per file). Metadata-only saves don't trigger a call.
          </p>
        )}

        <div className="flex items-center justify-between py-3 border-t border-border/40">
          <div className="space-y-0.5 pr-4">
            <Label>Summary detail level</Label>
            <p className="text-sm text-muted-foreground">
              How much of each file is sent for summarization. Higher = better summaries, more tokens.
            </p>
          </div>
          <Select
            value={summaryDetail}
            onValueChange={(v) => setSummaryDetail(v as SummaryDetail)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="brief">Brief (~125 tok)</SelectItem>
              <SelectItem value="standard">Standard (~500 tok)</SelectItem>
              <SelectItem value="detailed">Detailed (~1250 tok)</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </SettingsSection>

      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Clear Catalog"
        description="This empties the file index used by the in-app assistant and deletes the generated CLAUDE.md, AGENTS.md, GEMINI.md, and WORKSPACE_CONTEXT.md files. Rebuild to regenerate. This action cannot be undone."
        confirmLabel="Clear Catalog"
        variant="destructive"
        onConfirm={handleClearCatalog}
      />
    </>
  );
}
