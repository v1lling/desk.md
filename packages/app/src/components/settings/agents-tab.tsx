import {
  SettingsField,
  SettingsGroup,
  SettingsNotice,
  SettingsRow,
  SettingsSection,
} from "@/components/ui/settings-section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Trans, useTranslation } from "react-i18next";
import { useAgentSettingsStore, anyAgentFileEnabled } from "@/stores/agent-settings";
import { useWorkspaces } from "@/stores";
import {
  writePerWorkspaceAgentFiles,
  writeTopLevelAgentFiles,
} from "@/lib/smart-index/agent-files";
import { getDeskService } from "@desk/core";
import { useBootStore } from "@/stores/boot";
import { isDomainRemote } from "@/lib/connection";
import { AgentInstructionsCard } from "./agent-instructions-card";
import { AgentFilePreviewCard } from "./agent-file-preview-card";

export function AgentsTab() {
  const { t } = useTranslation();
  const {
    emitClaudeMd,
    emitAgentsMd,
    emitGeminiMd,
    setEmitClaudeMd,
    setEmitAgentsMd,
    setEmitGeminiMd,
  } = useAgentSettingsStore();
  const { data: workspaces = [] } = useWorkspaces();
  const remote = isDomainRemote();

  // Re-emit all agent files (or sweep disabled ones) after a toggle change.
  const refreshAgentFiles = async () => {
    try {
      for (const ws of workspaces) {
        const projects = await getDeskService().getProjects(ws.id);
        await writePerWorkspaceAgentFiles(ws.id, ws, projects);
      }
      await writeTopLevelAgentFiles(workspaces);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("errors.settings.agentFilesUpdateFailed", { message }));
    }
  };

  const makeToggleHandler =
    (setter: (v: boolean) => void, label: string) => async (enabled: boolean) => {
      setter(enabled);
      await refreshAgentFiles();
      toast.success(
        enabled
          ? t("toasts.settings.agentFileEnabled", { file: label })
          : t("toasts.settings.agentFileRemoved", { file: label }),
      );
    };

  const anyEnabled = anyAgentFileEnabled();
  return (
    <div className="space-y-8">
      <SettingsNotice>
        <Trans i18nKey="settings.agents.notice" components={{ strong: <strong /> }} />
      </SettingsNotice>

      <SettingsSection
        title={t("settings.agents.global.title")}
        description={t("settings.agents.global.description")}
      >
        <SettingsGroup>
          <AgentInstructionsCard />
          {!remote && <AgentFilePreviewCard />}
        </SettingsGroup>
      </SettingsSection>

      {remote ? (
        <McpSection />
      ) : (
        <SettingsSection
          title={t("settings.agents.emit.title")}
          description={t("settings.agents.emit.description")}
        >
          <SettingsGroup>
            <ToggleRow
              label="CLAUDE.md"
              description={t("settings.agents.emit.claude")}
              checked={emitClaudeMd}
              onChange={makeToggleHandler(setEmitClaudeMd, "CLAUDE.md")}
            />
            <ToggleRow
              label="AGENTS.md"
              description={t("settings.agents.emit.agents")}
              checked={emitAgentsMd}
              onChange={makeToggleHandler(setEmitAgentsMd, "AGENTS.md")}
            />
            <ToggleRow
              label="GEMINI.md"
              description={t("settings.agents.emit.gemini")}
              checked={emitGeminiMd}
              onChange={makeToggleHandler(setEmitGeminiMd, "GEMINI.md")}
            />
          </SettingsGroup>
          {!anyEnabled && (
            <SettingsNotice tone="warning">{t("settings.agents.emit.noneEnabled")}</SettingsNotice>
          )}
        </SettingsSection>
      )}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (enabled: boolean) => void;
}

function McpSection() {
  const { t } = useTranslation();
  const serverUrl = useBootStore((s) => s.serverUrl);
  // Hosted web is served from the server origin; native-remote stores the URL in boot.
  const base = import.meta.env.VITE_DESK_HOSTED ? window.location.origin : serverUrl;
  const mcpEndpoint = `${base.replace(/\/+$/, "")}/mcp`;

  const copyEndpoint = async () => {
    await navigator.clipboard.writeText(mcpEndpoint);
    toast.success(t("settings.agents.mcp.copied"));
  };

  return (
    <div>
      <SettingsSection
        title={t("settings.agents.mcp.title")}
        description={t("settings.agents.mcp.description")}
      >
        <div className="space-y-3">
          <SettingsNotice>
            <Trans i18nKey="settings.agents.mcp.notice" components={{ strong: <strong /> }} />
          </SettingsNotice>
          <SettingsGroup>
            <SettingsField
              label={t("settings.agents.mcp.endpointLabel")}
              htmlFor="mcp-endpoint"
              footer={t("settings.agents.mcp.hint")}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="mcp-endpoint"
                  readOnly
                  value={mcpEndpoint}
                  className="bg-background/80 font-mono"
                />
                <Button variant="outline" onClick={copyEndpoint}>
                  <Copy className="mr-2 size-4" />
                  {t("settings.agents.mcp.copy")}
                </Button>
              </div>
            </SettingsField>
          </SettingsGroup>
        </div>
      </SettingsSection>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <SettingsRow
      label={<code className="text-xs">{label}</code>}
      description={description}
    >
      <Switch checked={checked} onCheckedChange={onChange} />
    </SettingsRow>
  );
}
