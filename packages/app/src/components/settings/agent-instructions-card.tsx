import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trans, useTranslation } from "react-i18next";
import { useAgentInstructionsStore } from "@/stores/agent-instructions";

interface Props {
  /** "global" for top-level files; a workspaceId for per-workspace files. */
  scope: "global" | string;
}

export function AgentInstructionsCard({ scope }: Props) {
  const { t } = useTranslation();
  const isGlobal = scope === "global";
  const { global, perWorkspace, setGlobal, setForWorkspace } = useAgentInstructionsStore();

  const value = isGlobal ? global : (perWorkspace[scope] ?? "");
  const placeholder = isGlobal
    ? t("settings.agents.instructions.globalPlaceholder")
    : t("settings.agents.instructions.workspacePlaceholder");

  const handleChange = (next: string) => {
    if (isGlobal) setGlobal(next);
    else setForWorkspace(scope, next);
  };

  return (
    <div className="space-y-2 py-3">
      <Label htmlFor={`agent-instructions-${scope}`}>
        {isGlobal
          ? t("settings.agents.instructions.globalLabel")
          : t("settings.agents.instructions.workspaceLabel")}
      </Label>
      <p className="text-sm text-muted-foreground">
        <Trans
          i18nKey={
            isGlobal
              ? "settings.agents.instructions.globalDescription"
              : "settings.agents.instructions.workspaceDescription"
          }
          components={{ code: <code className="text-xs" /> }}
        />
      </p>
      <Textarea
        id={`agent-instructions-${scope}`}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[140px] font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        {t("settings.agents.instructions.charCount", { count: value.length })}
      </p>
    </div>
  );
}
