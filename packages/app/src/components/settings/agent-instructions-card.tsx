import { SettingsField } from "@/components/ui/settings-section";
import { Textarea } from "@/components/ui/textarea";
import { Trans, useTranslation } from "react-i18next";
import { useAgentInstructionsStore } from "@/stores/agent-instructions";

export function AgentInstructionsCard() {
  const { t } = useTranslation();
  const { global, setGlobal } = useAgentInstructionsStore();

  return (
    <SettingsField
      description={
        <Trans
          i18nKey="settings.agents.instructions.globalDescription"
          components={{ code: <code className="text-xs" /> }}
        />
      }
      footer={t("settings.agents.instructions.charCount", { count: global.length })}
    >
      <Textarea
        id="agent-instructions-global"
        aria-label={t("settings.agents.instructions.globalLabel")}
        value={global}
        onChange={(e) => setGlobal(e.target.value)}
        placeholder={t("settings.agents.instructions.globalPlaceholder")}
        maxLength={8_000}
        className="min-h-[180px] resize-y bg-background/80 font-mono text-sm leading-relaxed"
      />
    </SettingsField>
  );
}
