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
} from "lucide-react";
import { toast } from "sonner";
import { useRAGStore, type EmbeddingProvider } from "@/stores/rag";
import { useSettingsStore } from "@/stores/settings";
import * as rag from "@/lib/rag";
import type { IndexStatus, ReindexProgress } from "@/lib/rag";

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

export function RAGTab() {
  const { dataPath } = useSettingsStore();
  const {
    embeddingProvider,
    ollamaUrl,
    ollamaModel,
    openaiApiKey,
    voyageApiKey,
    retrievalCount,
    autoIndexOnSave,
    showSourcesInChat,
    setEmbeddingProvider,
    setOllamaUrl,
    setOllamaModel,
    setOpenaiApiKey,
    setVoyageApiKey,
    setRetrievalCount,
    setAutoIndexOnSave,
    setShowSourcesInChat,
  } = useRAGStore();

  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showVoyageKey, setShowVoyageKey] = useState(false);
  const [isTestingOllama, setIsTestingOllama] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ connected: boolean; error?: string } | null>(null);

  const [indexStatus, setIndexStatus] = useState<IndexStatus>({
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Fetch index status on mount and when dataPath changes
  const fetchStatus = useCallback(async () => {
    if (!dataPath) return;
    try {
      const status = await rag.getStatus(dataPath);
      setIndexStatus(status);
    } catch (error) {
      console.error("Failed to fetch index status:", error);
    }
  }, [dataPath]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

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

    try {
      const settings: rag.EmbeddingSettings = {
        provider: embeddingProvider,
        ollamaUrl,
        ollamaModel,
        openaiApiKey: openaiApiKey || undefined,
        voyageApiKey: voyageApiKey || undefined,
      };

      const result = await rag.reindexAll(dataPath, settings, setReindexProgress);

      await fetchStatus();

      if (result.errorChunks > 0) {
        toast.warning(`Indexed ${result.indexedChunks} chunks with ${result.errorChunks} errors`);
      } else {
        toast.success(`Indexed ${result.totalDocuments} documents (${result.indexedChunks} chunks)`);
      }
    } catch (error) {
      toast.error(`Re-indexing failed: ${error}`);
    } finally {
      setIsReindexing(false);
      setReindexProgress(null);
    }
  };

  const handleClearIndex = async () => {
    if (!dataPath) return;
    try {
      await rag.clearIndex(dataPath);
      await fetchStatus();
      toast.success("Index cleared");
    } catch (error) {
      toast.error(`Failed to clear index: ${error}`);
    }
    setShowClearConfirm(false);
  };

  const providerChanged = indexStatus.indexedWithProvider &&
    indexStatus.indexedWithProvider !== embeddingProvider &&
    embeddingProvider !== 'auto';

  return (
    <div className="space-y-4">
      {/* Embedding Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Document Search (RAG)
          </CardTitle>
          <CardDescription>
            Configure how documents are indexed for AI context
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Embedding Provider</Label>
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
                Changing provider requires re-indexing all documents. Current index was created with {indexStatus.indexedWithProvider}.
              </p>
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
                    {showOpenaiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
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
                    {showVoyageKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
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

      {/* Index Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Index Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-semibold">{indexStatus.documentCount}</p>
                <p className="text-xs text-muted-foreground">Documents indexed</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Puzzle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-semibold">{indexStatus.chunkCount}</p>
                <p className="text-xs text-muted-foreground">Total chunks</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{formatRelativeTime(indexStatus.lastIndexedAt)}</p>
                <p className="text-xs text-muted-foreground">Last indexed</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{formatBytes(indexStatus.indexSizeBytes)}</p>
                <p className="text-xs text-muted-foreground">Index size</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReindexAll}
                disabled={isReindexing}
              >
                {isReindexing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Re-index All
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowClearConfirm(true)}
                disabled={indexStatus.documentCount === 0 || isReindexing}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Index
              </Button>
            </div>

            {reindexProgress && (
              <div className="text-sm text-muted-foreground">
                {reindexProgress.phase === "collecting" && (
                  <span>Collecting documents...</span>
                )}
                {reindexProgress.phase === "indexing" && (
                  <span>
                    Indexing {reindexProgress.currentWorkspace}...{" "}
                    {reindexProgress.documentsProcessed}/{reindexProgress.totalDocuments} documents
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Retrieval Settings */}
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

      {/* Clear Index Confirmation */}
      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Clear Index"
        description="This will delete all indexed documents and vectors. You'll need to re-index to use RAG features. This action cannot be undone."
        confirmLabel="Clear Index"
        variant="destructive"
        onConfirm={handleClearIndex}
      />
    </div>
  );
}
