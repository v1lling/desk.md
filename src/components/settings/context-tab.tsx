import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Context Catalog
          </CardTitle>
          <CardDescription>
            Assistant retrieval is tool-driven and powered by the workspace context catalog.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Assistant does not auto-inject context at turn start. It chooses when to call catalog tools.
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
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
        </CardContent>
      </Card>

      <SmartIndexSection aiProviderConfigured />
    </div>
  );
}
