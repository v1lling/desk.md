import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Bot, Info } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAISettingsStore } from "@/stores/ai";
import { useContextStore } from "@/stores/context";
import { SystemPromptsCard } from "./system-prompts-card";

export function AssistantTab() {
  const { t } = useTranslation();
  const { customInstructions, setCustomInstructions } = useAISettingsStore();
  const { showToolDetails, setShowToolDetails } = useContextStore();

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={<Bot className="h-4 w-4" />}
        title={t("settings.assistant.title")}
        description={t("settings.assistant.description")}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              {t("settings.assistant.contextNotice")}
            </p>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-border/40">
            <div className="space-y-0.5 pr-4">
              <Label>{t("settings.assistant.toolDetails.label")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.assistant.toolDetails.description")}
              </p>
            </div>
            <Switch
              checked={showToolDetails}
              onCheckedChange={(checked) => {
                setShowToolDetails(checked);
                toast.success(
                  checked
                    ? t("toasts.settings.toolDetailsShown")
                    : t("toasts.settings.toolDetailsHidden"),
                );
              }}
            />
          </div>

          <div className="space-y-2 py-3 border-t border-border/40">
            <Label htmlFor="custom-instructions">{t("settings.assistant.customInstructions.label")}</Label>
            <p className="text-sm text-muted-foreground">
              {t("settings.assistant.customInstructions.description")}
            </p>
            <Textarea
              id="custom-instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={t("settings.assistant.customInstructions.placeholder")}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.assistant.customInstructions.helperText")}
            </p>
          </div>
        </div>
      </SettingsSection>

      <SystemPromptsCard />
    </div>
  );
}
