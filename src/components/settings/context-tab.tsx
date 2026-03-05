
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { useContextStore, type ContextStrategy } from "@/stores/context";
import { isAIProviderConfigured } from "./context-tab-utils";
import { SmartIndexSection } from "./smart-index-section";
import { EmbeddingSection } from "./embedding-section";

const STRATEGY_INFO: Record<ContextStrategy, { label: string; description: string }> = {
  index: {
    label: "Smart Index",
    description: "AI picks relevant files from a catalog of summaries. Requires AI provider configuration.",
  },
  rag: {
    label: "Embeddings",
    description: "Vector search using embeddings. Requires Ollama, OpenAI, or Voyage setup.",
  },
  none: {
    label: "None",
    description: "No automatic context retrieval. Only manually provided context is used.",
  },
};

export function ContextTab() {
  const {
    contextStrategy,
    showSourcesInChat,
    setContextStrategy,
    setShowSourcesInChat,
  } = useContextStore();

  const aiProviderConfigured = isAIProviderConfigured();
  const showAIProviderWarning = contextStrategy === "index" && !aiProviderConfigured;

  return (
    <div className="space-y-4">
      {/* Context Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Context Strategy
          </CardTitle>
          <CardDescription>
            How AI retrieves relevant context from your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Strategy</Label>
              <p className="text-sm text-muted-foreground">
                Choose how context is found for AI queries
              </p>
            </div>
            <Select
              value={contextStrategy}
              onValueChange={(value: ContextStrategy) => {
                setContextStrategy(value);
                toast.success(`Context strategy set to ${STRATEGY_INFO[value].label}`);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="index">Smart Index (recommended)</SelectItem>
                <SelectItem value="rag">Embeddings</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              {STRATEGY_INFO[contextStrategy].description}
            </p>
          </div>

          {showAIProviderWarning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">AI Provider Not Configured</p>
                <p className="text-sm text-destructive/90">
                  Smart Index requires an AI provider. Go to Settings → AI to configure Claude Code CLI or Anthropic API.
                </p>
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show sources in AI responses</Label>
              <p className="text-sm text-muted-foreground">
                Display which documents were used for context
              </p>
            </div>
            <Switch
              checked={showSourcesInChat}
              onCheckedChange={(checked) => {
                setShowSourcesInChat(checked);
                toast.success(checked ? "Sources will be shown" : "Sources hidden");
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Strategy-specific sections */}
      {contextStrategy === "index" && (
        <SmartIndexSection aiProviderConfigured={aiProviderConfigured} />
      )}

      {contextStrategy === "rag" && <EmbeddingSection />}

      {contextStrategy === "none" && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No automatic context retrieval. AI will only use manually provided context (e.g., open documents in the editor).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
