"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useSettingsStore,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
} from "@/stores/settings";
import { useWorkspaces } from "@/stores/workspaces";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Separator } from "@/components/ui/separator";
import { FolderOpen, Palette, Monitor, Sun, Moon, RotateCcw, Loader2, CheckCircle2, FolderPlus, Bot, Eye, EyeOff, AlertCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAISettingsStore, useAIUsageStore } from "@/stores/ai";
import { useQueryClient } from "@tanstack/react-query";
import { getWorkspaces, isTauri } from "@/lib/desk";
import { checkClaudeCode, type ClaudeCodeStatus } from "@/lib/ai/providers/claude-code";
import type { Workspace } from "@/types";

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

export default function SettingsPage() {
  const {
    dataPath,
    theme,
    sidebarWidth,
    setDataPath,
    setTheme,
    setSidebarWidth,
    setCurrentWorkspaceId,
    setSetupCompleted,
    reset,
  } = useSettingsStore();

  const isCollapsed = sidebarWidth <= SIDEBAR_COLLAPSED_WIDTH;

  const queryClient = useQueryClient();
  const { data: workspaces = [] } = useWorkspaces();

  // AI settings
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

  // State for data path change dialog
  const [pendingPath, setPendingPath] = useState("");
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [isCheckingPath, setIsCheckingPath] = useState(false);
  const [foundWorkspaces, setFoundWorkspaces] = useState<Workspace[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleCheckDataPath = async () => {
    if (!pendingPath.trim()) return;

    setIsCheckingPath(true);

    try {
      // Temporarily set the path so getWorkspaces knows where to look
      const oldPath = dataPath;
      setDataPath(pendingPath);

      if (isTauri()) {
        const existingWorkspaces = await getWorkspaces();
        setFoundWorkspaces(existingWorkspaces);
        setPathDialogOpen(true);
      } else {
        // In browser mode, just update the path
        queryClient.invalidateQueries();
        toast.success("Data path updated");
      }

      // If dialog will open, restore old path until user confirms
      if (isTauri()) {
        setDataPath(oldPath);
      }
    } catch (error) {
      console.error("Error checking path:", error);
      setFoundWorkspaces([]);
      setPathDialogOpen(true);
    } finally {
      setIsCheckingPath(false);
    }
  };

  const handleConfirmPathChange = (useExisting: boolean) => {
    setDataPath(pendingPath);
    queryClient.invalidateQueries();

    if (useExisting && foundWorkspaces.length > 0) {
      // Use first existing workspace
      setCurrentWorkspaceId(foundWorkspaces[0].id);
      toast.success(`Switched to ${pendingPath} with existing data`);
    } else if (foundWorkspaces.length === 0) {
      // No workspaces found - trigger setup wizard for this path
      setSetupCompleted(false);
      toast.success("Data path updated. Create your first workspace.");
    } else {
      // User wants to create new despite existing
      setSetupCompleted(false);
      toast.success("Data path updated. Setup wizard will guide you.");
    }

    setPathDialogOpen(false);
    setPendingPath("");
    setFoundWorkspaces([]);
  };

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);

    // Apply theme to document
    const root = document.documentElement;
    if (newTheme === "system") {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", systemDark);
    } else {
      root.classList.toggle("dark", newTheme === "dark");
    }

    toast.success(`Theme set to ${newTheme}`);
  };

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = () => {
    reset();
    // Invalidate all queries
    queryClient.invalidateQueries();
    // Apply system theme
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", systemDark);
    toast.success("Settings reset to defaults");
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <main className="p-4">
          <div className="max-w-2xl space-y-4">
          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize how Desk looks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Select your preferred color scheme
                  </p>
                </div>
                <Select value={theme} onValueChange={handleThemeChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <span className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </span>
                    </SelectItem>
                    <SelectItem value="dark">
                      <span className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </span>
                    </SelectItem>
                    <SelectItem value="system">
                      <span className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        System
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Compact sidebar</Label>
                  <p className="text-sm text-muted-foreground">
                    Show only icons in the sidebar (or drag the edge to resize)
                  </p>
                </div>
                <Switch
                  checked={isCollapsed}
                  onCheckedChange={(checked) => {
                    setSidebarWidth(checked ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_DEFAULT_WIDTH);
                    toast.success(checked ? "Sidebar collapsed" : "Sidebar expanded");
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* AI Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Assistant
              </CardTitle>
              <CardDescription>
                Configure your AI provider
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

          {/* Data Storage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Data Storage
              </CardTitle>
              <CardDescription>
                Where your projects and files are stored
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="data-path">Data folder path</Label>
                <div className="flex gap-2">
                  <Input
                    id="data-path"
                    value={pendingPath || dataPath}
                    onChange={(e) => setPendingPath(e.target.value)}
                    placeholder="~/Desk"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={handleCheckDataPath}
                    disabled={isCheckingPath || !pendingPath.trim() || pendingPath === dataPath}
                  >
                    {isCheckingPath && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  All your workspaces, projects, tasks, and notes are stored as markdown files in this folder.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Workspaces Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Workspaces</CardTitle>
              <CardDescription>
                Your configured workspaces
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workspaces.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workspaces configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {workspaces.map((workspace) => (
                    <div
                      key={workspace.id}
                      className="flex items-center gap-3 p-2 rounded-md border"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: workspace.color || "#6366f1" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{workspace.name}</p>
                        {workspace.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {workspace.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Reset
              </CardTitle>
              <CardDescription>
                Reset application settings to defaults
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleResetClick}>
                Reset All Settings
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will reset all settings and show the setup wizard again. Your data files will not be deleted.
              </p>
            </CardContent>
          </Card>
          </div>
        </main>
      </ScrollArea>

      {/* Data Path Change Dialog */}
      <Dialog open={pathDialogOpen} onOpenChange={setPathDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            {foundWorkspaces.length > 0 ? (
              <>
                <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <DialogTitle>Existing Data Found</DialogTitle>
                <DialogDescription>
                  Found {foundWorkspaces.length} workspace{foundWorkspaces.length > 1 ? "s" : ""} at this location.
                </DialogDescription>
              </>
            ) : (
              <>
                <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FolderPlus className="h-6 w-6 text-primary" />
                </div>
                <DialogTitle>Empty Location</DialogTitle>
                <DialogDescription>
                  No Desk data found at this path. You&apos;ll need to create your first workspace.
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          {foundWorkspaces.length > 0 && (
            <div className="space-y-2 py-2">
              {foundWorkspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: workspace.color || "#3b82f6" }}
                  />
                  <div>
                    <p className="font-medium text-sm">{workspace.name}</p>
                    {workspace.description && (
                      <p className="text-xs text-muted-foreground">{workspace.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {foundWorkspaces.length > 0 ? (
              <>
                <Button onClick={() => handleConfirmPathChange(true)}>
                  Use Existing Data
                </Button>
                <Button variant="outline" onClick={() => handleConfirmPathChange(false)}>
                  Start Fresh Instead
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => handleConfirmPathChange(false)}>
                  Continue to Setup
                </Button>
                <Button variant="outline" onClick={() => setPathDialogOpen(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Settings Confirmation Dialog */}
      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Reset All Settings"
        description="Are you sure you want to reset all settings to defaults? This will show the setup wizard again. Your data files will not be deleted."
        confirmLabel="Reset"
        variant="destructive"
        onConfirm={handleResetConfirm}
      />
    </div>
  );
}
