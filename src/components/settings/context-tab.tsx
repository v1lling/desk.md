"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Brain,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Puzzle,
  Clock,
  HardDrive,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useContextStore, type ContextStrategy, type EmbeddingProvider } from "@/stores/context";
import { useContextIndexStore } from "@/stores/context-index";
import { useSettingsStore } from "@/stores/settings";
import { useWorkspaces } from "@/stores";
import { useAISettingsStore } from "@/stores/ai";
import * as rag from "@/lib/rag";
import type { IndexStatus, ReindexProgress } from "@/lib/rag";
import { buildWorkspaceIndex } from "@/lib/context-index/builder";
import type { BuildIndexProgress, BuildIndexResult } from "@/lib/context-index/types";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

const STRATEGY_INFO: Record<ContextStrategy, { label: string; description: string }> = {
  index: {
    label: "Smart Index",
    description: "AI picks relevant files from a catalog of summaries. Requires AI provider configuration.",
  },
  rag: {
    label: "Embeddings",
    description: "Vector search using embeddings. Requires Ollama, OpenAI, or Voyage setup.",
  },
  none: {
    label: "None",
    description: "No automatic context retrieval. Only manually provided context is used.",
  },
};

/**
 * Check if AI provider is configured for Smart Index.
 * Claude Code CLI works without API key, Anthropic API requires key.
 */
function isAIProviderConfigured(): boolean {
  const { providerType, anthropicApiKey } = useAISettingsStore.getState();

  if (providerType === "claude-code") {
    return true; // CLI doesn't need API key
  }

  if (providerType === "anthropic-api") {
    return !!anthropicApiKey?.trim();
  }

  return false;
}

export function ContextTab() {
  const { dataPath } = useSettingsStore();
  const {
    contextStrategy,
    maxFilesPerQuery,
    autoSummarizeOnSave,
    embeddingProvider,
    ollamaUrl,
    ollamaModel,
    openaiApiKey,
    voyageApiKey,
    retrievalCount,
    scoreThreshold,
    autoIndexOnSave,
    showSourcesInChat,
    setContextStrategy,
    setMaxFilesPerQuery,
    setAutoSummarizeOnSave,
    setEmbeddingProvider,
    setOllamaUrl,
    setOllamaModel,
    setOpenaiApiKey,
    setVoyageApiKey,
    setRetrievalCount,
    setScoreThreshold,
    setAutoIndexOnSave,
    setShowSourcesInChat,
  } = useContextStore();

  const { indexes, setIndex, isBuilding, setIsBuilding } = useContextIndexStore();
  const { data: workspaces = [] } = useWorkspaces();
  const currentWorkspaceId = useSettingsStore((s) => s.currentWorkspaceId);

  // Smart Index state
  const [indexProgress, setIndexProgress] = useState<BuildIndexProgress | null>(null);
  const [indexResult, setIndexResult] = useState<BuildIndexResult | null>(null);
  const [showClearIndexConfirm, setShowClearIndexConfirm] = useState(false);

  // RAG state
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showVoyageKey, setShowVoyageKey] = useState(false);
  const [isTestingOllama, setIsTestingOllama] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ connected: boolean; error?: string } | null>(null);
  const [ragIndexStatus, setRagIndexStatus] = useState<IndexStatus>({
    documentCount: 0,
    chunkCount: 0,
    lastIndexedAt: null,
    indexSizeBytes: 0,
    indexedWithProvider: null,
    indexedWithModel: null,
    dimensions: null,
  });
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState<ReindexProgress | null>(null);
  const [showClearRagConfirm, setShowClearRagConfirm] = useState(false);
  const [lastIndexErrors, setLastIndexErrors] = useState<string[]>([]);

  // Compute index stats across all workspaces
  const totalIndexFiles = Object.values(indexes).reduce((sum, idx) => sum + idx.fileCount, 0);
  const lastBuiltAt = Object.values(indexes)
    .map((idx) => idx.builtAt)
    .sort()
    .pop() ?? null;

  // Fetch RAG index status
  const fetchRagStatus = useCallback(async () => {
    if (!dataPath || contextStrategy !== "rag") return;
    try {
      const status = await rag.getStatus(dataPath);
      setRagIndexStatus(status);
    } catch (error) {
      console.error("Failed to fetch RAG index status:", error);
    }
  }, [dataPath, contextStrategy]);

  useEffect(() => {
    fetchRagStatus();
  }, [fetchRagStatus]);

  // Check AI provider configuration
  const aiProviderConfigured = isAIProviderConfigured();
  const showAIProviderWarning = contextStrategy === "index" && !aiProviderConfigured;

  // ── Smart Index handlers ──────────────────────────────────────────────

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

        // Accumulate results locally
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

      // Update state with final result
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

  // ── RAG handlers ──────────────────────────────────────────────────────

  const handleTestOllama = async () => {
    setIsTestingOllama(true);
    setOllamaStatus(null);
    try {
      const connected = await rag.checkOllama(ollamaUrl);
      if (connected) {
        setOllamaStatus({ connected: true });
        toast.success("Ollama connected");
      } else {
        setOllamaStatus({ connected: false, error: "Could not reach Ollama server" });
      }
    } catch {
      setOllamaStatus({ connected: false, error: "Could not reach Ollama server" });
    } finally {
      setIsTestingOllama(false);
    }
  };

  const handleReindexAll = async () => {
    if (!dataPath) {
      toast.error("No data path configured");
      return;
    }

    setIsReindexing(true);
    setReindexProgress(null);
    setLastIndexErrors([]);

    try {
      const settings: rag.EmbeddingSettings = {
        provider: embeddingProvider,
        ollamaUrl,
        ollamaModel,
        openaiApiKey: openaiApiKey || undefined,
        voyageApiKey: voyageApiKey || undefined,
      };

      const result = await rag.reindexAll(dataPath, settings, setReindexProgress);
      await fetchRagStatus();

      if (result.indexErrors && result.indexErrors.length > 0) {
        setLastIndexErrors(result.indexErrors);
      }

      if (result.errorChunks > 0) {
        toast.warning(`Indexed ${result.indexedChunks} chunks with ${result.errorChunks} errors`);
      } else {
        toast.success(`Indexed ${result.totalDocuments} documents (${result.indexedChunks} chunks)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Re-indexing failed: ${message}`);
      setLastIndexErrors([message]);
    } finally {
      setIsReindexing(false);
      setReindexProgress(null);
    }
  };

  const handleClearRagIndex = async () => {
    if (!dataPath) return;
    try {
      await rag.clearIndex(dataPath);
      await fetchRagStatus();
      toast.success("RAG index cleared");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to clear index: ${message}`);
    }
    setShowClearRagConfirm(false);
  };

  const providerChanged = ragIndexStatus.indexedWithProvider &&
    ragIndexStatus.indexedWithProvider !== embeddingProvider &&
    embeddingProvider !== "auto";

  const getProviderWarning = (): string | null => {
    switch (embeddingProvider) {
      case "openai":
        if (!openaiApiKey?.trim()) return "OpenAI API key is required.";
        break;
      case "voyage":
        if (!voyageApiKey?.trim()) return "Voyage API key is required.";
        break;
      case "auto":
        if (!openaiApiKey?.trim() && !voyageApiKey?.trim() && ollamaStatus?.connected === false) {
          return "Ollama is not running and no cloud API keys configured.";
        }
        break;
    }
    return null;
  };

  const providerWarning = getProviderWarning();

  return (
    <div className="space-y-4">
      {/* Context Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Context Strategy
          </CardTitle>
          <CardDescription>
            How AI retrieves relevant context from your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Strategy</Label>
              <p className="text-sm text-muted-foreground">
                Choose how context is found for AI queries
              </p>
            </div>
            <Select
              value={contextStrategy}
              onValueChange={(value: ContextStrategy) => {
                setContextStrategy(value);
                toast.success(`Context strategy set to ${STRATEGY_INFO[value].label}`);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="index">Smart Index (recommended)</SelectItem>
                <SelectItem value="rag">Embeddings</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              {STRATEGY_INFO[contextStrategy].description}
            </p>
          </div>

          {showAIProviderWarning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">AI Provider Not Configured</p>
                <p className="text-sm text-destructive/90">
                  Smart Index requires an AI provider. Go to Settings → AI to configure Claude Code CLI or Anthropic API.
                </p>
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show sources in AI responses</Label>
              <p className="text-sm text-muted-foreground">
                Display which documents were used for context
              </p>
            </div>
            <Switch
              checked={showSourcesInChat}
              onCheckedChange={(checked) => {
                setShowSourcesInChat(checked);
                toast.success(checked ? "Sources will be shown" : "Sources hidden");
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Smart Index Settings ── */}
      {contextStrategy === "index" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Index Status</CardTitle>
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
                    Build Index
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
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Index Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Max files per query</Label>
                  <p className="text-sm text-muted-foreground">
                    Maximum number of files included as AI context
                  </p>
                </div>
                <Select
                  value={String(maxFilesPerQuery)}
                  onValueChange={(value) => {
                    setMaxFilesPerQuery(Number(value));
                    toast.success(`Max files set to ${value}`);
                  }}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="6">6</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="12">12</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

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
        </>
      )}

      {/* ── RAG / Embeddings Settings ── */}
      {contextStrategy === "rag" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Embedding Provider</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Provider</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose how to generate embeddings
                  </p>
                </div>
                <Select
                  value={embeddingProvider}
                  onValueChange={(value: EmbeddingProvider) => {
                    setEmbeddingProvider(value);
                    toast.success(`Embedding provider set to ${value}`);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Ollama first)</SelectItem>
                    <SelectItem value="ollama">Ollama (local, free)</SelectItem>
                    <SelectItem value="openai">OpenAI ($0.02/1M tokens)</SelectItem>
                    <SelectItem value="voyage">Voyage ($0.02/1M tokens)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {providerChanged && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Changing provider requires re-indexing. Current index was created with {ragIndexStatus.indexedWithProvider}.
                  </p>
                </div>
              )}

              {providerWarning && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{providerWarning}</p>
                </div>
              )}

              <Separator />

              {/* Ollama Settings */}
              {(embeddingProvider === "ollama" || embeddingProvider === "auto") && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Ollama Settings</Label>
                  <div className="space-y-2">
                    <Label htmlFor="ollama-url" className="text-xs text-muted-foreground">Server URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="ollama-url"
                        value={ollamaUrl}
                        onChange={(e) => setOllamaUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestOllama}
                        disabled={isTestingOllama}
                      >
                        {isTestingOllama ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                    </div>
                    {ollamaStatus && (
                      <div className="flex items-center gap-2 text-sm">
                        {ollamaStatus.connected ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Connected</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <span className="text-destructive">{ollamaStatus.error}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ollama-model" className="text-xs text-muted-foreground">Model</Label>
                    <Input
                      id="ollama-model"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="nomic-embed-text"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Run <code className="bg-muted px-1 rounded">ollama pull nomic-embed-text</code> to install
                    </p>
                  </div>
                </div>
              )}

              {/* OpenAI Settings */}
              {(embeddingProvider === "openai" || embeddingProvider === "auto") && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">OpenAI Settings</Label>
                  <div className="space-y-2">
                    <Label htmlFor="openai-key" className="text-xs text-muted-foreground">API Key</Label>
                    <div className="relative">
                      <Input
                        id="openai-key"
                        type={showOpenaiKey ? "text" : "password"}
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="font-mono text-sm pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      >
                        {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Uses text-embedding-3-small (1536 dimensions)
                    </p>
                  </div>
                </div>
              )}

              {/* Voyage Settings */}
              {(embeddingProvider === "voyage" || embeddingProvider === "auto") && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Voyage Settings</Label>
                  <div className="space-y-2">
                    <Label htmlFor="voyage-key" className="text-xs text-muted-foreground">API Key</Label>
                    <div className="relative">
                      <Input
                        id="voyage-key"
                        type={showVoyageKey ? "text" : "password"}
                        value={voyageApiKey}
                        onChange={(e) => setVoyageApiKey(e.target.value)}
                        placeholder="pa-..."
                        className="font-mono text-sm pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowVoyageKey(!showVoyageKey)}
                      >
                        {showVoyageKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Uses voyage-3.5-lite (1024 dimensions) - optimized for RAG
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* RAG Index Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">RAG Index Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-semibold">{ragIndexStatus.documentCount}</p>
                    <p className="text-xs text-muted-foreground">Documents indexed</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Puzzle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-semibold">{ragIndexStatus.chunkCount}</p>
                    <p className="text-xs text-muted-foreground">Total chunks</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{formatRelativeTime(ragIndexStatus.lastIndexedAt)}</p>
                    <p className="text-xs text-muted-foreground">Last indexed</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <HardDrive className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{formatBytes(ragIndexStatus.indexSizeBytes)}</p>
                    <p className="text-xs text-muted-foreground">Index size</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleReindexAll} disabled={isReindexing}>
                    {isReindexing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Re-index All
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowClearRagConfirm(true)}
                    disabled={ragIndexStatus.documentCount === 0 || isReindexing}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Index
                  </Button>
                </div>

                {reindexProgress && (
                  <div className="text-sm text-muted-foreground">
                    {reindexProgress.phase === "collecting" && <span>Collecting documents...</span>}
                    {reindexProgress.phase === "indexing" && (
                      <span>
                        Indexing {reindexProgress.currentWorkspace}...{" "}
                        {reindexProgress.documentsProcessed}/{reindexProgress.totalDocuments} documents
                      </span>
                    )}
                  </div>
                )}

                {lastIndexErrors.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      <span className="text-sm font-medium text-destructive">
                        Errors ({lastIndexErrors.length > 9 ? "10+" : lastIndexErrors.length})
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-6 px-2 text-xs"
                        onClick={() => setLastIndexErrors([])}
                      >
                        Dismiss
                      </Button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {lastIndexErrors.map((error, idx) => (
                        <p key={idx} className="text-xs text-destructive/90 font-mono break-all">
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* RAG Retrieval Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Retrieval Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Results per query</Label>
                  <p className="text-sm text-muted-foreground">
                    Number of relevant chunks to include in AI context
                  </p>
                </div>
                <Select
                  value={String(retrievalCount)}
                  onValueChange={(value) => {
                    setRetrievalCount(Number(value));
                    toast.success(`Retrieval count set to ${value}`);
                  }}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Minimum relevance score</Label>
                  <p className="text-sm text-muted-foreground">
                    Filter out low-quality matches below this threshold
                  </p>
                </div>
                <Select
                  value={String(Math.round(scoreThreshold * 100))}
                  onValueChange={(value) => {
                    const threshold = Number(value) / 100;
                    setScoreThreshold(threshold);
                    toast.success(`Score threshold set to ${value}%`);
                  }}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue>{Math.round(scoreThreshold * 100)}%</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="20">20%</SelectItem>
                    <SelectItem value="30">30%</SelectItem>
                    <SelectItem value="40">40%</SelectItem>
                    <SelectItem value="50">50%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-index on save</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically index documents when saved
                  </p>
                </div>
                <Switch
                  checked={autoIndexOnSave}
                  onCheckedChange={(checked) => {
                    setAutoIndexOnSave(checked);
                    toast.success(checked ? "Auto-index enabled" : "Auto-index disabled");
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── None ── */}
      {contextStrategy === "none" && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No automatic context retrieval. AI will only use manually provided context (e.g., open documents in the editor).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={showClearIndexConfirm}
        onOpenChange={setShowClearIndexConfirm}
        title="Clear Context Index"
        description="This will delete all file summaries. You'll need to rebuild the index for AI context features. This action cannot be undone."
        confirmLabel="Clear Index"
        variant="destructive"
        onConfirm={handleClearContextIndex}
      />
      <ConfirmDialog
        open={showClearRagConfirm}
        onOpenChange={setShowClearRagConfirm}
        title="Clear RAG Index"
        description="This will delete all indexed documents and vectors. You'll need to re-index to use embedding features. This action cannot be undone."
        confirmLabel="Clear Index"
        variant="destructive"
        onConfirm={handleClearRagIndex}
      />
    </div>
  );
}
