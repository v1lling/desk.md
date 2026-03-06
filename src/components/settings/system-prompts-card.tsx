import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAISettingsStore } from "@/stores/ai";
import { BASE_CONTEXT, USER_FACING_PROMPTS } from "@/lib/ai";

function CollapsiblePrompt({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        {label}
      </button>
      {open && (
        <pre className="mt-2 p-3 rounded-md bg-muted text-xs text-muted-foreground whitespace-pre-wrap font-mono">
          {content}
        </pre>
      )}
    </div>
  );
}

export function SystemPromptsCard() {
  const { perTypeInstructions, setPerTypeInstructions } = useAISettingsStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          System Prompts
        </CardTitle>
        <CardDescription>
          View the default instructions given to the AI for each interaction type and add your own per-type instructions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CollapsiblePrompt label="View base context (included in all prompts)" content={BASE_CONTEXT} />

        <Separator />

        {USER_FACING_PROMPTS.map(({ purpose, label, description, defaultPrompt }, index) => (
          <div key={purpose}>
            {index > 0 && <Separator className="mb-4" />}
            <div className="space-y-3">
              <div>
                <Label>{label}</Label>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>

              <CollapsiblePrompt label="View default prompt" content={defaultPrompt} />

              <div className="space-y-1.5">
                <Label className="text-sm font-normal text-muted-foreground">
                  Additional instructions for {label.toLowerCase()}
                </Label>
                <Textarea
                  value={perTypeInstructions[purpose] ?? ""}
                  onChange={(e) => setPerTypeInstructions(purpose, e.target.value)}
                  placeholder={`e.g., specific instructions for ${label.toLowerCase()}...`}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </div>
        ))}

        <p className="text-xs text-muted-foreground">
          Per-type instructions are combined with your global custom instructions above.
        </p>
      </CardContent>
    </Card>
  );
}
