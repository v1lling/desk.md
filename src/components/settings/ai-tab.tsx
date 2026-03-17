import { useEffect, useState } from "react";
import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Eye, EyeOff, KeyRound, Cable } from "lucide-react";
import { toast } from "sonner";
import { useAISettingsStore, useAIUsageStore } from "@/stores/ai";
import { PROVIDER_MODELS, DEFAULT_MODELS } from "@/lib/ai/models";
import type { AIProviderType } from "@/lib/ai/types";
import { getSecret, setSecret } from "@/lib/ai/secrets";
import { getMcpStatus, runMcpSelfTest, type McpStatus } from "@/lib/mcp";
import { SystemPromptsCard } from "./system-prompts-card";

function AIUsageStats() {
  const { getStats, clearRecords, records } = useAIUsageStore();
  const stats = getStats();

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Usage Statistics</Label>
        {records.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
            clearRecords();
            toast.success("Usage history cleared");
          }}>
            Clear
          </Button>
        )}
      </div>

      {stats.totalRequests === 0 ? (
        <p className="text-sm text-muted-foreground">No usage yet</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold">{formatNumber(stats.totalTokens)}</p>
            <p className="text-xs text-muted-foreground">Total tokens</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold">{stats.totalRequests}</p>
            <p className="text-xs text-muted-foreground">Requests</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function AITab() {
  const {
    providerType,
    providerConfigured,
    customInstructions,
    modelByProvider,
    setProviderType,
    setProviderConfigured,
    setCustomInstructions,
    setModelForProvider,
  } = useAISettingsStore();

  const safeProviderType: AIProviderType =
    providerType in PROVIDER_MODELS ? providerType : "openai";
  const activeModel = modelByProvider[safeProviderType] || DEFAULT_MODELS[safeProviderType];
  const modelOptions = PROVIDER_MODELS[safeProviderType];
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const keyRef = safeProviderType === "openai" ? "ai.openai" : "ai.anthropic";
      const key = await getSecret(keyRef);
      if (!cancelled) setApiKeyInput(key ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [safeProviderType]);

  useEffect(() => {
    if (providerType !== safeProviderType) {
      setProviderType(safeProviderType);
    }
  }, [providerType, safeProviderType, setProviderType]);

  const handleSaveApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      toast.error("API key cannot be empty");
      return;
    }

    setIsSavingKey(true);
    try {
      const keyRef = safeProviderType === "openai" ? "ai.openai" : "ai.anthropic";
      await setSecret(keyRef, trimmed);
      setProviderConfigured(safeProviderType, true);
      toast.success(`${safeProviderType === "openai" ? "OpenAI" : "Anthropic"} key saved to keychain`);
    } catch (error) {
      toast.error(`Failed to save API key: ${String(error)}`);
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={<Bot className="h-4 w-4" />}
        title="Assistant"
        description="Configure API provider, model, and instructions for Assistant and drafting features."
      >
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label>Provider</Label>
              <p className="text-sm text-muted-foreground">AI API backend</p>
            </div>
            <Select
              value={safeProviderType}
              onValueChange={(value: AIProviderType) => {
                setProviderType(value);
                toast.success(`Provider set to ${value === "openai" ? "OpenAI" : "Anthropic"}`);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label>Model</Label>
              <p className="text-sm text-muted-foreground">Default model for provider</p>
            </div>
            <Select
              value={activeModel}
              onValueChange={(value) => {
                setModelForProvider(safeProviderType, value);
                const label = modelOptions.find((m) => m.id === value)?.label ?? value;
                toast.success(`Model set to ${label}`);
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 py-3">
            <Label htmlFor="api-key" className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              API Key ({safeProviderType === "openai" ? "OpenAI" : "Anthropic"})
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={safeProviderType === "openai" ? "sk-..." : "sk-ant-..."}
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button onClick={handleSaveApiKey} disabled={isSavingKey}>
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Stored in OS keychain. Not persisted in app localStorage.
            </p>
            {!providerConfigured[safeProviderType] && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Provider key not configured.
              </p>
            )}
          </div>

          <div className="space-y-2 py-3">
            <Label htmlFor="custom-instructions">Custom Instructions</Label>
            <p className="text-sm text-muted-foreground">
              Always included in prompt generation.
            </p>
            <Textarea
              id="custom-instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g., respond with concise bullet points."
              className="min-h-[100px]"
            />
          </div>

          <div className="py-3">
            <AIUsageStats />
          </div>
        </div>
      </SettingsSection>

      <SystemPromptsCard />
      <McpStatusCard />
    </div>
  );
}

function McpStatusCard() {
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRunningSelfTest, setIsRunningSelfTest] = useState(false);
  const [selfTestOutput, setSelfTestOutput] = useState<string>("");
  const [activeSnippet, setActiveSnippet] = useState<"claude" | "codex" | "gemini">("claude");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await getMcpStatus();
        if (!cancelled) {
          setStatus(next);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(`Failed to load MCP status: ${String(error)}`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentSnippet = status
    ? activeSnippet === "claude"
      ? status.claude_config_snippet
      : activeSnippet === "codex"
        ? status.codex_config_snippet
        : status.gemini_config_snippet
    : "";

  const handleCopy = async () => {
    if (!currentSnippet) {
      toast.error("No MCP config snippet available");
      return;
    }
    try {
      await navigator.clipboard.writeText(currentSnippet);
      toast.success("MCP config copied");
    } catch (error) {
      toast.error(`Failed to copy MCP config: ${String(error)}`);
    }
  };

  const handleSelfTest = async () => {
    setIsRunningSelfTest(true);
    setSelfTestOutput("");
    try {
      const result = await runMcpSelfTest();
      setSelfTestOutput(result.output || "(no output)");
      if (result.ok) {
        toast.success("MCP self-test passed");
      } else {
        toast.error("MCP self-test failed");
      }
    } catch (error) {
      toast.error(`MCP self-test failed: ${String(error)}`);
    } finally {
      setIsRunningSelfTest(false);
    }
  };

  return (
    <SettingsSection
      icon={<Cable className="h-4 w-4" />}
      title="Advanced: MCP Interoperability"
      description="External CLI integration. Assistant uses direct in-app tools; MCP is optional for power users."
      variant="inset"
    >
      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading MCP status...</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Transport</p>
                <p className="text-sm font-medium">{status?.transport || "-"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Server Command</p>
                <p className="text-sm font-mono break-all">{status?.command || "-"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Data Root</p>
                <p className="text-sm font-mono break-all">{status?.data_root || "-"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Shared Config</p>
                <p className="text-sm font-mono break-all">{status?.shared_config_path || "-"}</p>
              </div>
            </div>
            {!status?.available && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                desk-mcp sidecar binary not found at the resolved command path. Build or bundle the sidecar to enable one-click self-test.
              </p>
            )}

            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Config snippet</p>
                <div className="flex gap-1">
                  <Button size="sm" variant={activeSnippet === "claude" ? "default" : "outline"} onClick={() => setActiveSnippet("claude")}>
                    Claude
                  </Button>
                  <Button size="sm" variant={activeSnippet === "codex" ? "default" : "outline"} onClick={() => setActiveSnippet("codex")}>
                    Codex
                  </Button>
                  <Button size="sm" variant={activeSnippet === "gemini" ? "default" : "outline"} onClick={() => setActiveSnippet("gemini")}>
                    Gemini
                  </Button>
                </div>
              </div>
              <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto">
{currentSnippet || "{}"}
              </pre>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={handleSelfTest} disabled={isRunningSelfTest}>
                  {isRunningSelfTest ? "Testing..." : "Run self-test"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  Copy config
                </Button>
              </div>
            </div>
            {selfTestOutput && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Self-test output</p>
                <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap">
{selfTestOutput}
                </pre>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              External MCP workflows run in your CLI. In-app Assistant uses direct tool calls instead of MCP transport.
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
