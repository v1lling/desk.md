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

export function CustomInstructionsCard() {
  const { t } = useTranslation();
  const { customInstructions, setCustomInstructions, perTypeInstructions, setPerTypeInstructions } =
    useAISettingsStore();

  return (
    <SettingsSection
      icon={<ScrollText className="h-4 w-4" />}
      title={t("settings.customInstructions.title")}
      description={t("settings.customInstructions.description")}
    >
      <div className="divide-y divide-border/40">
        <div className="pb-4">
          <CollapsiblePrompt
            label={t("settings.customInstructions.viewBaseContext")}
            content={BASE_CONTEXT}
          />
        </div>

        <div className="space-y-2 py-4">
          <Label htmlFor="custom-instructions-global">
            {t("settings.customInstructions.global.label")}
          </Label>
          <Textarea
            id="custom-instructions-global"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder={t("settings.customInstructions.global.placeholder")}
            className="min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.customInstructions.global.helperText")}
          </p>
        </div>

        {USER_FACING_PROMPTS.map(({ purpose, defaultPrompt }) => {
          const label = t(`settings.customInstructions.purposes.${purpose}.label`);
          const description = t(`settings.customInstructions.purposes.${purpose}.description`);
          return (
            <div key={purpose} className="py-4">
              <div className="space-y-3">
                <div>
                  <Label>{label}</Label>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>

                <CollapsiblePrompt
                  label={t("settings.customInstructions.viewDefaultPrompt")}
                  content={defaultPrompt}
                />

                <Textarea
                  value={perTypeInstructions[purpose] ?? ""}
                  onChange={(e) => setPerTypeInstructions(purpose, e.target.value)}
                  placeholder={t("settings.customInstructions.perTypePlaceholder", {
                    label: label.toLowerCase(),
                  })}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
}
