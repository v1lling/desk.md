import { useEffect, useState } from "react";
import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Eye, EyeOff, Info, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAISettingsStore, useAIUsageStore } from "@/stores/ai";
import { PROVIDER_MODELS, DEFAULT_MODELS } from "@/lib/ai/models";
import type { AIProviderType } from "@/lib/ai/types";
import { BrowserModeError, getSecret, setSecret } from "@/lib/ai/secrets";
import { isTauri } from "@/lib/desk/tauri-fs";

function linuxKeyringHint(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes("secret service") || lower.includes("no such interface") || lower.includes("dbus")) {
    return "On Linux, this usually means GNOME Keyring or KWallet isn't running. Start your desktop secret service and try again.";
  }
  return null;
}

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
    modelByProvider,
    aiConsentGiven,
    setProviderType,
    setProviderConfigured,
    setModelForProvider,
    setAIConsentGiven,
  } = useAISettingsStore();

  const safeProviderType: AIProviderType =
    providerType in PROVIDER_MODELS ? providerType : "openai";
  const activeModel = modelByProvider[safeProviderType] || DEFAULT_MODELS[safeProviderType];
  const modelOptions = PROVIDER_MODELS[safeProviderType];
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const browserMode = !isTauri();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const keyRef = safeProviderType === "openai" ? "ai.openai" : "ai.anthropic";
      try {
        const key = await getSecret(keyRef);
        if (cancelled) return;
        setApiKeyInput(key ?? "");
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        setApiKeyInput("");
        setLoadError(error instanceof BrowserModeError ? null : String(error));
      }
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
      setLoadError(null);
      toast.success(`${safeProviderType === "openai" ? "OpenAI" : "Anthropic"} key saved to keychain`);
    } catch (error) {
      const message = String(error);
      const hint = linuxKeyringHint(message);
      toast.error(hint ? `Failed to save API key: ${message}\n\n${hint}` : `Failed to save API key: ${message}`);
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={<Sparkles className="h-4 w-4" />}
        title="Provider"
        description="Connect an AI provider. Powers the assistant, drafting, and catalog summaries."
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

            {browserMode && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">AI is unavailable in browser mode</p>
                    <p className="text-muted-foreground text-xs">
                      API keys are only stored in the OS keychain, which Desk can&apos;t
                      reach from <code className="font-mono">npm run dev</code>. Run{" "}
                      <code className="font-mono">npm run tauri:dev</code> (or the built
                      app) to configure providers and use the assistant.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {loadError && !browserMode && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm flex-1 min-w-0">
                    <p className="font-medium text-destructive">Couldn&apos;t read the keychain</p>
                    <p className="text-xs text-destructive/90">
                      Desk couldn&apos;t fetch the stored key. Saving a new one may still
                      work, but existing keys can&apos;t be loaded until this clears.
                    </p>
                    {linuxKeyringHint(loadError) && (
                      <p className="text-xs text-destructive/90">{linuxKeyringHint(loadError)}</p>
                    )}
                    <details className="text-xs text-destructive/80">
                      <summary className="cursor-pointer">Error details</summary>
                      <p className="mt-1 font-mono break-all">{loadError}</p>
                    </details>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={safeProviderType === "openai" ? "sk-..." : "sk-ant-..."}
                  className="font-mono text-sm pr-10"
                  disabled={browserMode}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                  disabled={browserMode}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button onClick={handleSaveApiKey} disabled={isSavingKey || browserMode}>
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Stored in the OS keychain (Keychain / Credential Manager / Secret Service).
            </p>
            {!browserMode && !loadError && !providerConfigured[safeProviderType] && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Provider key not configured.
              </p>
            )}
          </div>

          <div className="py-3">
            <AIUsageStats />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={<ShieldCheck className="h-4 w-4" />}
        title="Data & Privacy"
        description="What Desk sends to your AI provider, and when."
      >
        <div className="space-y-3 py-3 text-sm text-muted-foreground">
          <p>
            AI features send content to the provider selected above (Anthropic or
            OpenAI) over their API. Desk has no AI server of its own, and nothing
            is sent until you configure an API key.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="text-foreground">Assistant chat &amp; drafting</span>:
              your messages, the conversation history, and the contents of files
              the assistant reads to answer you.
            </li>
            <li>
              <span className="text-foreground">Smart Index</span>: short previews
              and summaries of your files, sent when you rebuild the catalog or,
              if Auto-summarize on save is enabled, automatically after a save.
            </li>
          </ul>
          <p>
            Retention is governed by your provider's API terms. Anthropic and
            OpenAI state that API data is not used to train their models by default.
          </p>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">Privacy acknowledgement</p>
              <p className="text-xs">
                {aiConsentGiven
                  ? "You have acknowledged the AI privacy notice."
                  : "Shown once before your first AI request."}
              </p>
            </div>
            {aiConsentGiven && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAIConsentGiven(false);
                  toast.success("AI privacy acknowledgement reset");
                }}
              >
                Revoke
              </Button>
            )}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
