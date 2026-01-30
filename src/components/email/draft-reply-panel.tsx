"use client";

import { useState, useCallback, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { SlidePanel } from "@/components/ui/slide-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAIAction, useAISettingsStore } from "@/stores/ai";
import { isTauri } from "@/lib/desk";
import type { IncomingEmail } from "@/lib/email/types";
import { formatEmailAddress } from "@/lib/email/types";

interface DraftReplyPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: IncomingEmail;
  workspaceId?: string;
  projectId?: string;
}

export function DraftReplyPanel({
  open,
  onOpenChange,
  email,
  workspaceId: _workspaceId,
  projectId: _projectId,
}: DraftReplyPanelProps) {
  // TODO: Use workspaceId/projectId to fetch project docs as AI context
  void _workspaceId;
  void _projectId;

  // Email fields (editable)
  const [to, setTo] = useState(email.from.email);
  const [subject, setSubject] = useState(
    email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`
  );
  const [cc, setCc] = useState(
    email.cc?.map((c) => c.email).join(", ") || ""
  );

  // Draft state
  const [instructions, setInstructions] = useState("");
  const [draft, setDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const providerType = useAISettingsStore((state) => state.providerType);
  const { draftEmail } = useAIAction();

  // Reset fields when email changes
  useEffect(() => {
    setTo(email.from.email);
    setSubject(email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
    setCc(email.cc?.map((c) => c.email).join(", ") || "");
    setDraft("");
    setInstructions("");
    setError(null);
  }, [email]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setDraft("");
    setError(null);

    try {
      // Use the proper draftEmail method from AIService
      const response = await draftEmail(
        {
          from: formatEmailAddress(email.from),
          subject: email.subject,
          body: email.body,
        },
        instructions || "Write a professional reply.",
        // TODO: Add project docs as context when projectId is set
      );

      if (response?.message) {
        setDraft(response.message);
      } else {
        setError("No response received from AI.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[draft-reply] Generation failed:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [email, instructions, draftEmail]);

  const handleSendViaMailClient = useCallback(async () => {
    // Build mailto URL with proper RFC 6068 encoding
    // Note: URLSearchParams uses + for spaces, but mailto: needs %20
    const params: string[] = [];
    params.push(`subject=${encodeURIComponent(subject)}`);
    params.push(`body=${encodeURIComponent(draft)}`);
    if (cc.trim()) {
      params.push(`cc=${encodeURIComponent(cc)}`);
    }

    const mailto = `mailto:${encodeURIComponent(to)}?${params.join("&")}`;

    // Open in default mail client
    if (isTauri()) {
      try {
        await openUrl(mailto);
      } catch (err) {
        console.error("[draft-reply] Failed to open mail client:", err);
      }
    } else {
      window.location.href = mailto;
    }
  }, [to, subject, cc, draft]);

  const hasAIProvider = providerType !== null;

  const footerContent = draft ? (
    <div className="space-y-2">
      <Button onClick={handleSendViaMailClient} className="w-full">
        <Send className="h-4 w-4 mr-2" />
        Open in Mail Client
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Opens your default mail app with the draft pre-filled
      </p>
    </div>
  ) : undefined;

  return (
    <SlidePanel
      open={open}
      onClose={() => onOpenChange(false)}
      title={`Reply to: ${formatEmailAddress(email.from)}`}
      footer={footerContent}
    >
      <div className="space-y-4">
        {/* Instructions */}
        <div className="space-y-2">
          <Label htmlFor="instructions">Instructions (optional)</Label>
          <Input
            id="instructions"
            placeholder="e.g., be brief, decline politely, ask for more details..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={isGenerating}
          />
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !hasAIProvider}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Draft
            </>
          )}
        </Button>

        {!hasAIProvider && (
          <p className="text-sm text-muted-foreground text-center">
            Configure an AI provider in Settings to use this feature.
          </p>
        )}

        {/* Error display - keep generic, details in Settings */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">
              Failed to generate draft. Check Settings → AI to test your connection.
            </p>
          </div>
        )}

        {/* Email fields and draft - shown after generation */}
        {draft && (
          <div className="space-y-4 pt-2 border-t">
            {/* To */}
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
              />
            </div>

            {/* CC */}
            <div className="space-y-2">
              <Label htmlFor="cc">CC (optional)</Label>
              <Input
                id="cc"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc1@example.com, cc2@example.com"
              />
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {/* Draft body */}
            <div className="space-y-2">
              <Label htmlFor="draft">Message</Label>
              <Textarea
                id="draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </SlidePanel>
  );
}

