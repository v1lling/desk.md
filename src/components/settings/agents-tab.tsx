import { useState } from "react";
import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Info } from "lucide-react";
import { toast } from "sonner";
import { useContextStore, anyAgentFileEnabled } from "@/stores/context";
import { useWorkspaces } from "@/stores";
import {
  writePerWorkspaceAgentFiles,
  writeTopLevelAgentFiles,
} from "@/lib/context-index/agent-context";
import { getProjects } from "@/lib/desk/projects";
import { AgentInstructionsCard } from "./agent-instructions-card";
import { AgentFilePreviewCard } from "./agent-file-preview-card";

const GLOBAL_SCOPE = "global";

export function AgentsTab() {
  const {
    emitClaudeMd,
    emitAgentsMd,
    emitGeminiMd,
    setEmitClaudeMd,
    setEmitAgentsMd,
    setEmitGeminiMd,
  } = useContextStore();
  const { data: workspaces = [] } = useWorkspaces();
  const [scope, setScope] = useState<string>(GLOBAL_SCOPE);

  // Re-emit all agent files (or sweep disabled ones) after a toggle change.
  const refreshAgentFiles = async () => {
    try {
      for (const ws of workspaces) {
        const projects = await getProjects(ws.id);
        await writePerWorkspaceAgentFiles(ws.id, ws, projects);
      }
      await writeTopLevelAgentFiles(workspaces);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Could not update agent files: ${message}`);
    }
  };

  const makeToggleHandler =
    (setter: (v: boolean) => void, label: string) => async (enabled: boolean) => {
      setter(enabled);
      await refreshAgentFiles();
      toast.success(enabled ? `${label} enabled` : `${label} removed`);
    };

  const anyEnabled = anyAgentFileEnabled();
  const selectedWorkspace =
    scope !== GLOBAL_SCOPE ? workspaces.find((w) => w.id === scope) : undefined;

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={<Users className="h-4 w-4" />}
        title="External Agents"
        description="Generate Markdown files alongside your data so external CLI agents understand your work with no setup."
      >
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            These settings apply to <strong>external CLI agents</strong> (Claude Code,
            Codex, Gemini CLI) reading your data folder directly. For instructions to
            the <strong>in-app assistant</strong>, see Settings → Assistant.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Emit Files"
        description="Choose which agent files to write into your data folder. Identical content, three filenames."
      >
        <ToggleRow
          label="CLAUDE.md"
          description="For Claude Code"
          checked={emitClaudeMd}
          onChange={makeToggleHandler(setEmitClaudeMd, "CLAUDE.md")}
        />
        <ToggleRow
          label="AGENTS.md"
          description="For Codex / OpenAI Agents"
          checked={emitAgentsMd}
          onChange={makeToggleHandler(setEmitAgentsMd, "AGENTS.md")}
          bordered
        />
        <ToggleRow
          label="GEMINI.md"
          description="For Gemini CLI"
          checked={emitGeminiMd}
          onChange={makeToggleHandler(setEmitGeminiMd, "GEMINI.md")}
          bordered
        />
        {!anyEnabled && (
          <p className="pt-3 text-xs text-amber-600 dark:text-amber-400">
            No agent files are being emitted. Your instructions below are saved but
            won't be written to disk until at least one toggle is on.
          </p>
        )}
      </SettingsSection>

      <div className={!anyEnabled ? "opacity-60" : undefined}>
        <SettingsSection
          title="Global Instructions"
          description="Inlined into the top-level agent files. Applies across all workspaces."
        >
          <AgentInstructionsCard scope={GLOBAL_SCOPE} />
          <AgentFilePreviewCard scope={GLOBAL_SCOPE} />
        </SettingsSection>
      </div>

      <div className={!anyEnabled ? "opacity-60" : undefined}>
        <SettingsSection
          title="Per-Workspace"
          description="Workspace-specific instructions appended to that workspace's agent files."
        >
          <div className="space-y-1 py-3">
            <Label>Workspace</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL_SCOPE}>Select a workspace…</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ws.color || "#6366f1" }}
                      />
                      {ws.name}
                      {ws.isHome && (
                        <span className="text-xs text-muted-foreground">(home)</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedWorkspace ? (
            <>
              <AgentInstructionsCard scope={selectedWorkspace.id} />
              <AgentFilePreviewCard scope={selectedWorkspace.id} />
            </>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">
              Select a workspace to edit its instructions.
            </p>
          )}
        </SettingsSection>
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (enabled: boolean) => void;
  bordered?: boolean;
}

function ToggleRow({ label, description, checked, onChange, bordered }: ToggleRowProps) {
  return (
    <div
      className={`flex items-center justify-between py-3 ${
        bordered ? "border-t border-border/40" : ""
      }`}
    >
      <div className="space-y-0.5 pr-4">
        <Label>
          <code className="text-xs">{label}</code>
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
