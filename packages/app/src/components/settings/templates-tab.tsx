import { useCallback, useState } from "react";
import {
  SettingsField,
  SettingsGroup,
  SettingsNotice,
  SettingsRow,
  SettingsSection,
} from "@/components/ui/settings-section";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspaces } from "@/stores";
import { useTemplatesStore } from "@/stores/templates";
import { DEFAULT_TEMPLATES, type TemplateType } from "@/lib/templates";

const GLOBAL_SCOPE = "__global__";

interface TemplateMeta {
  type: TemplateType;
  /** i18n key fragment under settings.templates.types */
  metaKey: "meeting" | "doc" | "task";
  hasNote?: boolean;
}

const TEMPLATE_TYPES: TemplateMeta[] = [
  { type: "meeting", metaKey: "meeting" },
  { type: "doc", metaKey: "doc", hasNote: true },
  { type: "task", metaKey: "task" },
];

function TemplateCard({
  type,
  metaKey,
  hasNote,
  scope,
}: {
  type: TemplateType;
  metaKey: "meeting" | "doc" | "task";
  hasNote?: boolean;
  scope: string;
}) {
  const { t } = useTranslation();
  const isGlobal = scope === GLOBAL_SCOPE;
  const {
    global,
    workspaces,
    setGlobalTemplate,
    setWorkspaceTemplate,
    clearWorkspaceTemplate,
    getTemplate,
  } = useTemplatesStore();

  const hasWorkspaceOverride = !isGlobal && workspaces[scope]?.[type] !== undefined;
  const currentValue = isGlobal
    ? (global[type] ?? DEFAULT_TEMPLATES[type])
    : hasWorkspaceOverride
      ? workspaces[scope][type]!
      : "";
  const resolvedValue = getTemplate(type, isGlobal ? "" : scope);

  const handleChange = useCallback(
    (value: string) => {
      if (isGlobal) setGlobalTemplate(type, value);
      else setWorkspaceTemplate(scope, type, value);
    },
    [isGlobal, scope, type, setGlobalTemplate, setWorkspaceTemplate],
  );

  const handleReset = useCallback(() => {
    if (isGlobal) setGlobalTemplate(type, DEFAULT_TEMPLATES[type]);
    else clearWorkspaceTemplate(scope, type);
  }, [isGlobal, scope, type, setGlobalTemplate, clearWorkspaceTemplate]);

  const handleCustomize = useCallback(() => {
    setWorkspaceTemplate(scope, type, resolvedValue);
  }, [scope, type, resolvedValue, setWorkspaceTemplate]);

  const label = t(`settings.templates.types.${metaKey}.label`);
  const description = t(`settings.templates.types.${metaKey}.description`);
  const note = hasNote ? t(`settings.templates.types.${metaKey}.note`) : undefined;

  return (
    <SettingsSection
      title={t("settings.templates.cardTitle", { label })}
      description={description}
    >
      <SettingsGroup>
        <SettingsField
          htmlFor={`template-${type}`}
          footer={
            !isGlobal && !hasWorkspaceOverride ? undefined : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  {t("settings.templates.variablesLabel")} {" "}
                  <code>{"{{title}}"}</code>{" "}
                  <code>{"{{date}}"}</code>{" "}
                  <code>{"{{project}}"}</code>{" "}
                  <code>{"{{workspace}}"}</code>
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-8 self-start text-xs sm:self-auto"
                >
                  <RotateCcw className="mr-1 size-3" />
                  {isGlobal
                    ? t("settings.templates.resetToDefault")
                    : t("settings.templates.removeOverride")}
                </Button>
              </div>
            )
          }
        >
          {!isGlobal && !hasWorkspaceOverride ? (
            <div className="space-y-3">
              <SettingsNotice>
                <p>{t("settings.templates.usingGlobalDefault")}</p>
                {resolvedValue && (
                  <pre className="mt-2 max-h-20 overflow-hidden whitespace-pre-wrap font-mono text-xs text-muted-foreground/80">
                    {resolvedValue}
                  </pre>
                )}
              </SettingsNotice>
              <Button variant="outline" size="sm" onClick={handleCustomize}>
                {t("settings.templates.customizeForWorkspace")}
              </Button>
            </div>
          ) : (
            <>
              <Textarea
                id={`template-${type}`}
                value={currentValue}
                onChange={(event) => handleChange(event.target.value)}
                placeholder={t("settings.templates.placeholder")}
                className="min-h-[140px] resize-y bg-background/80 font-mono text-sm"
              />
              {note && <p className="text-xs text-muted-foreground">{note}</p>}
            </>
          )}
        </SettingsField>
      </SettingsGroup>
    </SettingsSection>
  );
}

export function TemplatesTab() {
  const { t } = useTranslation();
  const { data: workspaces = [] } = useWorkspaces();
  const [scope, setScope] = useState(GLOBAL_SCOPE);

  return (
    <div className="space-y-8">
      <SettingsSection
        title={t("settings.templates.scopeTitle")}
        description={t("settings.templates.scopeDescription")}
      >
        <SettingsGroup>
          <SettingsRow label={t("settings.templates.scopeLabel")}>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL_SCOPE}>
                  {t("settings.templates.globalDefaults")}
                </SelectItem>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: workspace.color || "#6366f1" }}
                      />
                      {workspace.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsGroup>
      </SettingsSection>

      {TEMPLATE_TYPES.map(({ type, metaKey, hasNote }) => (
        <TemplateCard
          key={`${scope}-${type}`}
          type={type}
          metaKey={metaKey}
          hasNote={hasNote}
          scope={scope}
        />
      ))}
    </div>
  );
}
