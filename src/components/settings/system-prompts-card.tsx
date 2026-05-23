import { useState } from "react";
import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    <SettingsSection
      icon={<ScrollText className="h-4 w-4" />}
      title="System Prompts"
      description="Default prompts the AI receives, plus your own per-type additions."
    >
      <div className="divide-y divide-border/40">
        <div className="pb-4">
          <CollapsiblePrompt label="View base context (included in all prompts)" content={BASE_CONTEXT} />
        </div>

        {USER_FACING_PROMPTS.map(({ purpose, label, description, defaultPrompt }) => (
          <div key={purpose} className="py-4">
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

        <div className="pt-4">
          <p className="text-xs text-muted-foreground">
            Per-type instructions are combined with your global custom instructions above.
          </p>
        </div>
      </div>
    </SettingsSection>
  );
}
