import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Bot, Info } from "lucide-react";
import { toast } from "sonner";
import { useAISettingsStore } from "@/stores/ai";
import { useContextStore } from "@/stores/context";
import { SystemPromptsCard } from "./system-prompts-card";

export function AssistantTab() {
  const { customInstructions, setCustomInstructions } = useAISettingsStore();
  const { showToolDetails, setShowToolDetails } = useContextStore();

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={<Bot className="h-4 w-4" />}
        title="Assistant"
        description="How the in-app assistant chats, drafts, and retrieves context."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              The assistant doesn't auto-inject context at the start of a turn — it
              decides when to query the catalog and read files. Manage the catalog
              itself under Settings → Catalog.
            </p>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-border/40">
            <div className="space-y-0.5 pr-4">
              <Label>Show tool details in assistant responses</Label>
              <p className="text-sm text-muted-foreground">
                Display tool arguments, results, and retrieved file details inline.
              </p>
            </div>
            <Switch
              checked={showToolDetails}
              onCheckedChange={(checked) => {
                setShowToolDetails(checked);
                toast.success(checked ? "Tool details will be shown" : "Tool details hidden");
              }}
            />
          </div>

          <div className="space-y-2 py-3 border-t border-border/40">
            <Label htmlFor="custom-instructions">Custom Instructions</Label>
            <p className="text-sm text-muted-foreground">
              Always included in prompt generation, for both the assistant and drafting.
            </p>
            <Textarea
              id="custom-instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g., respond with concise bullet points."
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              For instructions to external CLI agents (Claude Code, Codex, Gemini CLI)
              reading your data folder, see Settings → Agents.
            </p>
          </div>
        </div>
      </SettingsSection>

      <SystemPromptsCard />
    </div>
  );
}
