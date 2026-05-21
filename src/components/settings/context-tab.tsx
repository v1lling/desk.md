import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Brain, Info } from "lucide-react";
import { toast } from "sonner";
import { useContextStore } from "@/stores/context";
import { SmartIndexSection } from "./smart-index-section";

export function ContextTab() {
  const {
    showToolDetails,
    setShowToolDetails,
  } = useContextStore();

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={<Brain className="h-4 w-4" />}
        title="Context Catalog"
        description="Assistant retrieval is tool-driven and powered by the workspace context catalog."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Assistant does not auto-inject context at turn start. It chooses when to call catalog tools.
            </p>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-border/40">
            <div className="space-y-0.5">
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
        </div>
      </SettingsSection>

      <SmartIndexSection />
    </div>
  );
}
