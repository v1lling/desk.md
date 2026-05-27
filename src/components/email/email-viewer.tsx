import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, ExternalLink, Loader2, ChevronRight, FolderKanban, Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAISettingsStore } from "@/stores/ai";
import { useAssistantStore } from "@/stores/assistant";
import { useTabStore } from "@/stores/tabs";
import { useNavigationStore } from "@/stores/navigation";
import { useWorkspaces } from "@/stores/workspaces";
import { useProjects } from "@/stores/projects";
import type { IncomingEmail } from "@/lib/email/types";
import { formatEmailAddress, formatEmailDate } from "@/lib/email/types";

interface EmailViewerProps {
  email: IncomingEmail;
}

// Matches MetadataToolbar's chipClass so the context selects sit visually
// alongside the chips in DocEditor / TaskEditor / MeetingEditor.
const chipClass =
  "border-none bg-transparent shadow-none px-1.5 gap-1.5 text-xs font-medium hover:bg-accent/50 rounded-md";

export function EmailViewer({ email }: EmailViewerProps) {
  const { t } = useTranslation();
  const [instructions, setInstructions] = useState("");
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [isLaunchingAssistant, setIsLaunchingAssistant] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { providerType, providerConfigured } = useAISettingsStore();
  const hasAIProvider = !!providerConfigured[providerType];
  const startEmailDraft = useAssistantStore((s) => s.startEmailDraft);
  const navigate = useNavigate();
  const setActiveTab = useTabStore((s) => s.setActiveTab);

  const currentWorkspaceId = useNavigationStore((s) => s.currentWorkspaceId);
  const { data: workspaces = [] } = useWorkspaces();
  const [workspaceId, setWorkspaceId] = useState<string | null>(currentWorkspaceId);
  const [projectId, setProjectId] = useState<string | null>(null);
  const { data: projects = [] } = useProjects(workspaceId);

  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === workspaceId) || null,
    [workspaces, workspaceId],
  );
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId],
  );

  useEffect(() => {
    setInstructions("");
    setError(null);
    setBodyExpanded(false);
    setWorkspaceId(currentWorkspaceId);
    setProjectId(null);
    // Reset everything when a different email lands in this tab.
    // currentWorkspaceId intentionally excluded — picking a workspace
    // here shouldn't be undone by a background nav store change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const handleWorkspaceChange = useCallback((value: string) => {
    setWorkspaceId(value === "_none" ? null : value);
    setProjectId(null);
  }, []);

  const handleProjectChange = useCallback((value: string) => {
    setProjectId(value === "_none" ? null : value);
  }, []);

  const handleOpenAssistantDraft = useCallback(async () => {
    setIsLaunchingAssistant(true);
    setError(null);

    try {
      setActiveTab("desk");
      navigate("/assistant");
      await startEmailDraft({
        email,
        instructions: instructions.trim() || undefined,
        workspaceId: workspaceId ?? undefined,
        workspaceName: selectedWorkspace?.name ?? undefined,
        projectId: projectId ?? undefined,
        projectName: selectedProject?.name ?? undefined,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[email-viewer] Failed to launch assistant draft:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsLaunchingAssistant(false);
    }
  }, [
    email,
    instructions,
    navigate,
    setActiveTab,
    startEmailDraft,
    workspaceId,
    selectedWorkspace,
    projectId,
    selectedProject,
  ]);

  const sourceKey = (() => {
    switch (email.source) {
      case "apple-mail":
        return "email.viewer.source.appleMail";
      case "outlook":
        return "email.viewer.source.outlook";
      case "thunderbird":
        return "email.viewer.source.thunderbird";
      default:
        return "email.viewer.source.other";
    }
  })();
  const sourceDisplayName = email.source ? t(sourceKey) : null;
  const subtitleParts = [
    formatEmailAddress(email.from),
    email.date ? formatEmailDate(email.date) : null,
    sourceDisplayName ? t("email.viewer.viaSource", { source: sourceDisplayName }) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="shrink-0 bg-background">
        <div className="max-w-4xl mx-auto px-6 py-2">
          <h1 className="text-xl font-semibold truncate">
            {email.subject || t("email.viewer.noSubject")}
          </h1>
          {subtitleParts.length > 0 && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {subtitleParts.join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0">
        <div className="max-w-4xl mx-auto px-6">
          <div className="h-px bg-border/40 mt-4" />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-4xl mx-auto px-6 pt-3 pb-6 space-y-5">
          <div>
            <button
              type="button"
              onClick={() => setBodyExpanded((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={bodyExpanded}
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  bodyExpanded && "rotate-90",
                )}
              />
              {bodyExpanded ? t("email.viewer.hideFull") : t("email.viewer.showFull")}
            </button>
            {bodyExpanded && (
              <div className="mt-3 rounded-lg border bg-card max-h-[40vh] overflow-auto">
                <div className="p-4 space-y-3">
                  {(email.to?.length || email.cc?.length) && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {email.to && email.to.length > 0 && (
                        <div className="truncate">
                          <span className="font-medium">{t("email.viewer.toLabel")} </span>
                          {email.to.map(formatEmailAddress).join(", ")}
                        </div>
                      )}
                      {email.cc && email.cc.length > 0 && (
                        <div className="truncate">
                          <span className="font-medium">{t("email.viewer.ccLabel")} </span>
                          {email.cc.map(formatEmailAddress).join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {email.body}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="email-instructions"
              className="text-xs font-medium text-muted-foreground"
            >
              {t("email.replyHelper.instructionsLabel")}
            </label>
            <Textarea
              id="email-instructions"
              placeholder={t("email.replyHelper.instructionsPlaceholder")}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={isLaunchingAssistant}
              rows={3}
              className="resize-none min-h-[72px] text-sm"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t("email.replyHelper.contextHeading")}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={workspaceId ?? "_none"}
                onValueChange={handleWorkspaceChange}
                disabled={isLaunchingAssistant}
              >
                <SelectTrigger size="xs" className={cn(chipClass, "max-w-[200px]")}>
                  <Folder className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {selectedWorkspace?.name || t("email.replyHelper.noWorkspace")}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">
                    <span className="flex items-center gap-2">
                      <Folder className="h-3 w-3 text-muted-foreground" />
                      {t("email.replyHelper.noWorkspace")}
                    </span>
                  </SelectItem>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      <span className="flex items-center gap-2">
                        <Folder className="h-3 w-3 text-muted-foreground" />
                        {w.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={projectId ?? "_none"}
                onValueChange={handleProjectChange}
                disabled={isLaunchingAssistant || !workspaceId}
              >
                <SelectTrigger size="xs" className={cn(chipClass, "max-w-[200px]")}>
                  <FolderKanban className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {selectedProject?.name || t("email.replyHelper.noProject")}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">
                    <span className="flex items-center gap-2">
                      <FolderKanban className="h-3 w-3 text-muted-foreground" />
                      {t("email.replyHelper.noProject")}
                    </span>
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <FolderKanban className="h-3 w-3 text-muted-foreground" />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleOpenAssistantDraft}
              disabled={isLaunchingAssistant || !hasAIProvider}
            >
              {isLaunchingAssistant ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("email.replyHelper.opening")}
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4 mr-2" />
                  {t("email.replyHelper.openInAssistant")}
                </>
              )}
            </Button>
            <Button variant="outline" disabled>
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("email.replyHelper.extractTasks")}
              <span className="ml-2 text-xs text-muted-foreground">{t("email.replyHelper.comingSoon")}</span>
            </Button>
          </div>

          {!hasAIProvider && (
            <p className="text-xs text-muted-foreground">
              {t("email.replyHelper.configureProvider")}
            </p>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">
                {t("errors.email.draftStartFailed")}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
