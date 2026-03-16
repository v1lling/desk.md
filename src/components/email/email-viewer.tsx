import { useState, useCallback, useEffect } from "react";
import { Mail, User, Users, Calendar, Bot, ExternalLink, Loader2, ChevronUp, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAISettingsStore } from "@/stores/ai";
import { useAssistantStore } from "@/stores/assistant";
import { useOpenTab } from "@/stores/tabs";
import type { IncomingEmail } from "@/lib/email/types";
import { formatEmailAddress, formatEmailDate } from "@/lib/email/types";

interface EmailViewerProps {
  email: IncomingEmail;
  onClose: () => void;
}

export function EmailViewer({ email, onClose }: EmailViewerProps) {
  const [showDraft, setShowDraft] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [isLaunchingAssistant, setIsLaunchingAssistant] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { providerType, providerConfigured } = useAISettingsStore();
  const hasAIProvider = !!providerConfigured[providerType];
  const startEmailDraft = useAssistantStore((s) => s.startEmailDraft);
  const { openAI } = useOpenTab();

  useEffect(() => {
    setInstructions("");
    setError(null);
    setShowDraft(false);
  }, [email]);

  const handleOpenAssistantDraft = useCallback(async () => {
    setIsLaunchingAssistant(true);
    setError(null);

    try {
      openAI();
      await startEmailDraft({
        email,
        instructions: instructions.trim() || undefined,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[email-viewer] Failed to launch assistant draft:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsLaunchingAssistant(false);
    }
  }, [email, instructions, openAI, startEmailDraft]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="shrink-0 border-b px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{email.subject}</h1>
            <p className="text-sm text-muted-foreground">
              From external mail client ({email.source})
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 space-y-6">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">From:</span>
              <span className="font-medium">{formatEmailAddress(email.from)}</span>
            </div>

            {email.to && email.to.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">To:</span>
                <span>{email.to.map(formatEmailAddress).join(", ")}</span>
              </div>
            )}

            {email.cc && email.cc.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">CC:</span>
                <span>{email.cc.map(formatEmailAddress).join(", ")}</span>
              </div>
            )}

            {email.date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Date:</span>
                <span>{formatEmailDate(email.date)}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Message</h2>
            <div className="p-4 rounded-lg border bg-card">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {email.body}
              </pre>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant={showDraft ? "secondary" : "default"}
              onClick={() => setShowDraft(!showDraft)}
            >
              {showDraft ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Hide Draft
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4 mr-2" />
                  Draft Reply
                </>
              )}
            </Button>
            <Button variant="outline" disabled>
              <ExternalLink className="h-4 w-4 mr-2" />
              Extract Tasks
              <span className="ml-2 text-xs text-muted-foreground">(coming soon)</span>
            </Button>
          </div>

          {showDraft && (
            <div className="p-4 rounded-lg border bg-muted/20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Assistant Draft
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowDraft(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions" className="text-xs">Custom instructions (optional)</Label>
                <Input
                  id="instructions"
                  placeholder="e.g., be warm, concise, cite project status from docs..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  disabled={isLaunchingAssistant}
                  className="text-sm"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleOpenAssistantDraft}
                  disabled={isLaunchingAssistant || !hasAIProvider}
                  size="sm"
                >
                  {isLaunchingAssistant ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Opening Assistant...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 mr-2" />
                      Open Draft in Assistant
                    </>
                  )}
                </Button>
              </div>

              {!hasAIProvider && (
                <p className="text-xs text-muted-foreground">
                  Configure an AI provider in Settings to use Assistant drafting.
                </p>
              )}

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">Failed to start assistant draft. Check Settings → AI.</p>
                </div>
              )}

              <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
                Assistant opens with a prefilled draft request and starts one run automatically. Keep this tab open
                to reference the original email while refining the reply in Assistant. When ready, copy the final
                reply from Assistant and paste it into Outlook's Reply or Reply All composer.
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
