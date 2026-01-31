"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Bot, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAISettingsStore, useAIUsageStore } from "@/stores/ai";
import { checkClaudeCode, type ClaudeCodeStatus } from "@/lib/ai/providers/claude-code";

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
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              clearRecords();
              toast.success("Usage history cleared");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {stats.totalRequests === 0 ? (
        <p className="text-sm text-muted-foreground">No AI usage yet</p>
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
          {Object.entries(stats.byProvider).map(([provider, data]) => (
            <div key={provider} className="rounded-lg border p-3 col-span-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">
                  {provider === "claude-code" ? "Claude Code" : "Anthropic API"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatNumber(data.tokens)} tokens / {data.requests} requests
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AITab() {
  const {
    providerType,
    anthropicApiKey,
    setProviderType,
    setAnthropicApiKey,
  } = useAISettingsStore();

  const [showApiKey, setShowApiKey] = useState(false);
  const [claudeStatus, setClaudeStatus] = useState<ClaudeCodeStatus | null>(null);
  const [isTestingClaude, setIsTestingClaude] = useState(false);

  const handleTestClaudeCode = async () => {
    setIsTestingClaude(true);
    setClaudeStatus(null);
    try {
      const status = await checkClaudeCode();
      setClaudeStatus(status);
    } finally {
      setIsTestingClaude(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Assistant
          </CardTitle>
          <CardDescription>
            Configure your AI provider for chat
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Provider</Label>
              <p className="text-sm text-muted-foreground">
                Choose how to connect to Claude
              </p>
            </div>
            <Select
              value={providerType}
              onValueChange={(value: "claude-code" | "anthropic-api") => {
                setProviderType(value);
                toast.success(`AI provider set to ${value === "claude-code" ? "Claude Code" : "Anthropic API"}`);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-code">
                  Claude Code (CLI)
                </SelectItem>
                <SelectItem value="anthropic-api">
                  Anthropic API
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {providerType === "anthropic-api" && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="api-key"
                      type={showApiKey ? "text" : "password"}
                      value={anthropicApiKey}
                      onChange={(e) => setAnthropicApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="font-mono text-sm pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    console.anthropic.com
                  </a>
                </p>
              </div>
            </>
          )}

          {providerType === "claude-code" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Uses your local Claude Code CLI installation. Make sure Claude Code is installed and authenticated.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestClaudeCode}
                  disabled={isTestingClaude}
                >
                  {isTestingClaude ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Test Connection
                </Button>
                {claudeStatus && (
                  <div className="flex items-center gap-2 text-sm">
                    {claudeStatus.available ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Connected</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <span className="text-destructive">Failed</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              {claudeStatus && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {claudeStatus.path && (
                    <p>Path: <code className="bg-muted px-1 rounded">{claudeStatus.path}</code></p>
                  )}
                  {claudeStatus.error && (
                    <p className="text-destructive">{claudeStatus.error}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <Separator />

          <AIUsageStats />
        </CardContent>
      </Card>
    </div>
  );
}
