import { useState } from "react";
import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { perTypeInstructions, setPerTypeInstructions } = useAISettingsStore();

  // Translate the purpose label/description via i18n by purpose id. The source
  // constant in `src/lib/ai/prompts.ts` provides defaults for non-UI usage.
  const promptMeta = (purpose: string) => ({
    label: t(`settings.systemPrompts.purposes.${purpose}.label`),
    description: t(`settings.systemPrompts.purposes.${purpose}.description`),
  });

  return (
    <SettingsSection
      icon={<ScrollText className="h-4 w-4" />}
      title={t("settings.systemPrompts.title")}
      description={t("settings.systemPrompts.description")}
    >
      <div className="divide-y divide-border/40">
        <div className="pb-4">
          <CollapsiblePrompt label={t("settings.systemPrompts.viewBaseContext")} content={BASE_CONTEXT} />
        </div>

        {USER_FACING_PROMPTS.map(({ purpose, defaultPrompt }) => {
          const { label, description } = promptMeta(purpose);
          return (
            <div key={purpose} className="py-4">
              <div className="space-y-3">
                <div>
                  <Label>{label}</Label>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>

                <CollapsiblePrompt
                  label={t("settings.systemPrompts.viewDefaultPrompt")}
                  content={defaultPrompt}
                />

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal text-muted-foreground">
                    {t("settings.systemPrompts.additionalInstructions", { label: label.toLowerCase() })}
                  </Label>
                  <Textarea
                    value={perTypeInstructions[purpose] ?? ""}
                    onChange={(e) => setPerTypeInstructions(purpose, e.target.value)}
                    placeholder={t("settings.systemPrompts.placeholder", { label: label.toLowerCase() })}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </div>
          );
        })}

        <div className="pt-4">
          <p className="text-xs text-muted-foreground">
            {t("settings.systemPrompts.footer")}
          </p>
        </div>
      </div>
    </SettingsSection>
  );
}
