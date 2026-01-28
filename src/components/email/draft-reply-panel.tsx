"use client";

import { useState, useCallback } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { SlidePanel } from "@/components/ui/slide-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSendMessage, useAISettingsStore } from "@/stores/ai";
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
}: DraftReplyPanelProps) {
  const [instructions, setInstructions] = useState("");
  const [draft, setDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const providerType = useAISettingsStore((state) => state.providerType);
  const sendMessage = useSendMessage();

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setDraft("");

    try {
      // Build the prompt for drafting a reply
      const prompt = buildDraftPrompt(email, instructions);

      // Use the AI service to generate the draft
      const response = await sendMessage.mutateAsync({
        message: prompt,
        context: {
          emails: [{
            id: email.messageId || `email-${Date.now()}`,
            subject: email.subject,
            from: formatEmailAddress(email.from),
            body: email.body,
          }],
        },
      });

      // Extract the draft from the response
      if (response && typeof response === 'object' && 'message' in response) {
        setDraft(response.message || "Failed to generate draft. Please try again.");
      } else if (typeof response === 'string') {
        setDraft(response);
      } else {
        setDraft("Failed to generate draft. Please try again.");
      }
    } catch (error) {
      console.error("[draft-reply] Generation failed:", error);
      setDraft("Error: Failed to generate draft. Please check your AI settings.");
    } finally {
      setIsGenerating(false);
    }
  }, [email, instructions, sendMessage]);

  const handleSendViaMailClient = useCallback(() => {
    const to = email.from.email;
    const subject = email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`;
    const body = draft;

    // Build mailto URL
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Open in default mail client
    window.open(mailto, "_blank");
  }, [email, draft]);

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

        {/* Draft textarea */}
        {draft && (
          <div className="space-y-2">
            <Label htmlFor="draft">Draft Reply</Label>
            <Textarea
              id="draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              placeholder="Your draft will appear here..."
            />
          </div>
        )}
      </div>
    </SlidePanel>
  );
}

function buildDraftPrompt(email: IncomingEmail, instructions: string): string {
  let prompt = `Draft a reply to this email:

From: ${formatEmailAddress(email.from)}
Subject: ${email.subject}

${email.body}

---

Write a professional reply email.`;

  if (instructions) {
    prompt += `\n\nAdditional instructions: ${instructions}`;
  }

  prompt += `\n\nRespond with ONLY the email body text, no subject line or headers.`;

  return prompt;
}
