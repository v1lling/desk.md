import { useState, useCallback } from "react";
import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, RotateCcw } from "lucide-react";
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
      if (isGlobal) {
        setGlobalTemplate(type, value);
      } else {
        setWorkspaceTemplate(scope, type, value);
      }
    },
    [isGlobal, scope, type, setGlobalTemplate, setWorkspaceTemplate]
  );

  const handleReset = useCallback(() => {
    if (isGlobal) {
      setGlobalTemplate(type, DEFAULT_TEMPLATES[type]);
    } else {
      clearWorkspaceTemplate(scope, type);
    }
  }, [isGlobal, scope, type, setGlobalTemplate, clearWorkspaceTemplate]);

  const handleCustomize = useCallback(() => {
    // Initialize workspace override with the resolved value (global or default)
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
      <div className="space-y-3">
        {!isGlobal && !hasWorkspaceOverride ? (
          <div className="space-y-2">
            <div className="rounded-md border border-dashed p-3">
              <p className="text-sm text-muted-foreground">
                {t("settings.templates.usingGlobalDefault")}
              </p>
              {resolvedValue && (
                <pre className="mt-2 text-xs text-muted-foreground/70 whitespace-pre-wrap font-mono max-h-20 overflow-hidden">
                  {resolvedValue}
                </pre>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleCustomize}>
              {t("settings.templates.customizeForWorkspace")}
            </Button>
          </div>
        ) : (
          <>
            <Textarea
              value={currentValue}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={t("settings.templates.placeholder")}
              className="min-h-[120px] resize-y font-mono text-sm"
            />
            {note && (
              <p className="text-xs text-muted-foreground">{note}</p>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t("settings.templates.variablesLabel")}{" "}
                <code className="text-xs">{"{{title}}"}</code>{" "}
                <code className="text-xs">{"{{date}}"}</code>{" "}
                <code className="text-xs">{"{{project}}"}</code>{" "}
                <code className="text-xs">{"{{workspace}}"}</code>
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                {isGlobal
                  ? t("settings.templates.resetToDefault")
                  : t("settings.templates.removeOverride")}
              </Button>
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

export function TemplatesTab() {
  const { t } = useTranslation();
  const { data: workspaces = [] } = useWorkspaces();
  const [scope, setScope] = useState(GLOBAL_SCOPE);

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={<FileText className="h-4 w-4" />}
        title={t("settings.templates.title")}
        description={t("settings.templates.description")}
      >
        <div className="space-y-1">
          <Label>{t("settings.templates.scopeLabel")}</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GLOBAL_SCOPE}>{t("settings.templates.globalDefaults")}</SelectItem>
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ws.color || "#6366f1" }}
                    />
                    {ws.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
