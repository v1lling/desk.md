import { useEffect, useState } from "react";
import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Eye, EyeOff, Info, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAISettingsStore, useAIUsageStore } from "@/stores/ai";
import { PROVIDER_MODELS, DEFAULT_MODELS } from "@/lib/ai/models";
import type { AIProviderType } from "@/lib/ai/types";
import { BrowserModeError, getSecret, setSecret } from "@/lib/ai/secrets";
import { isTauri } from "@desk/core";
import { SmartIndexSection } from "./smart-index-section";

function linuxKeyringHint(message: string, t: (key: string) => string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes("secret service") || lower.includes("no such interface") || lower.includes("dbus")) {
    return t("settings.ai.errors.linuxKeyring");
  }
  return null;
}

function AIUsageStats() {
  const { t } = useTranslation();
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
        <Label>{t("settings.ai.usage.title")}</Label>
        {records.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
            clearRecords();
            toast.success(t("toasts.settings.usageCleared"));
          }}>
            {t("settings.ai.usage.clear")}
          </Button>
        )}
      </div>

      {stats.totalRequests === 0 ? (
        <p className="text-sm text-muted-foreground">{t("settings.ai.usage.noUsage")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold">{formatNumber(stats.totalTokens)}</p>
            <p className="text-xs text-muted-foreground">{t("settings.ai.usage.totalTokens")}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold">{stats.totalRequests}</p>
            <p className="text-xs text-muted-foreground">{t("settings.ai.usage.requests")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function AITab() {
  const { t } = useTranslation();
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

  const providerLabel = (p: AIProviderType): string =>
    p === "openai" ? t("settings.ai.providers.openai") : t("settings.ai.providers.anthropic");

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
      toast.error(t("errors.settings.apiKeyEmpty"));
      return;
    }

    setIsSavingKey(true);
    try {
      const keyRef = safeProviderType === "openai" ? "ai.openai" : "ai.anthropic";
      await setSecret(keyRef, trimmed);
      setProviderConfigured(safeProviderType, true);
      setLoadError(null);
      toast.success(t("toasts.settings.apiKeySaved", { provider: providerLabel(safeProviderType) }));
    } catch (error) {
      const message = String(error);
      const hint = linuxKeyringHint(message, t);
      toast.error(
        hint
          ? t("errors.settings.apiKeySaveFailedWithHint", { message, hint })
          : t("errors.settings.apiKeySaveFailed", { message }),
      );
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={<Sparkles className="h-4 w-4" />}
        title={t("settings.ai.provider.title")}
        description={t("settings.ai.provider.description")}
      >
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label>{t("settings.ai.provider.label")}</Label>
              <p className="text-sm text-muted-foreground">{t("settings.ai.provider.helperText")}</p>
            </div>
            <Select
              value={safeProviderType}
              onValueChange={(value: AIProviderType) => {
                setProviderType(value);
                toast.success(t("toasts.settings.providerSet", { provider: providerLabel(value) }));
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">{t("settings.ai.providers.openai")}</SelectItem>
                <SelectItem value="anthropic">{t("settings.ai.providers.anthropic")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label>{t("settings.ai.model.label")}</Label>
              <p className="text-sm text-muted-foreground">{t("settings.ai.model.helperText")}</p>
            </div>
            <Select
              value={activeModel}
              onValueChange={(value) => {
                setModelForProvider(safeProviderType, value);
                const label = modelOptions.find((m) => m.id === value)?.label ?? value;
                toast.success(t("toasts.settings.modelSet", { model: label }));
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
              {t("settings.ai.apiKey.label", { provider: providerLabel(safeProviderType) })}
            </Label>

            {browserMode && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{t("settings.ai.browserMode.title")}</p>
                    <p className="text-muted-foreground text-xs">
                      {t("settings.ai.browserMode.description")}
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
                    <p className="font-medium text-destructive">{t("settings.ai.keychainError.title")}</p>
                    <p className="text-xs text-destructive/90">
                      {t("settings.ai.keychainError.description")}
                    </p>
                    {linuxKeyringHint(loadError, t) && (
                      <p className="text-xs text-destructive/90">{linuxKeyringHint(loadError, t)}</p>
                    )}
                    <details className="text-xs text-destructive/80">
                      <summary className="cursor-pointer">{t("settings.ai.keychainError.errorDetails")}</summary>
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
                  placeholder={
                    safeProviderType === "openai"
                      ? t("settings.ai.apiKey.placeholderOpenai")
                      : t("settings.ai.apiKey.placeholderAnthropic")
                  }
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
                  aria-label={
                    showApiKey
                      ? t("settings.ai.apiKey.hideAriaLabel")
                      : t("settings.ai.apiKey.showAriaLabel")
                  }
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button onClick={handleSaveApiKey} disabled={isSavingKey || browserMode}>
                {t("common.buttons.save")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settings.ai.apiKey.storedNotice")}
            </p>
            {!browserMode && !loadError && !providerConfigured[safeProviderType] && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("settings.ai.apiKey.notConfigured")}
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
        title={t("settings.ai.privacy.title")}
        description={t("settings.ai.privacy.description")}
      >
        <div className="space-y-3 py-3 text-sm text-muted-foreground">
          <p>{t("settings.ai.privacy.intro")}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="text-foreground">{t("settings.ai.privacy.smartIndexLabel")}</span>
              {t("settings.ai.privacy.smartIndexBody")}
            </li>
          </ul>
          <p>{t("settings.ai.privacy.retention")}</p>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">{t("settings.ai.privacy.acknowledgement.title")}</p>
              <p className="text-xs">
                {aiConsentGiven
                  ? t("settings.ai.privacy.acknowledgement.given")
                  : t("settings.ai.privacy.acknowledgement.notGiven")}
              </p>
            </div>
            {aiConsentGiven && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAIConsentGiven(false);
                  toast.success(t("toasts.settings.privacyAcknowledgementReset"));
                }}
              >
                {t("settings.ai.privacy.acknowledgement.revoke")}
              </Button>
            )}
          </div>
        </div>
      </SettingsSection>

      <SmartIndexSection />
    </div>
  );
}
