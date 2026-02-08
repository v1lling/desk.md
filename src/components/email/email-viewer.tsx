"use client";

import { useState, useCallback, useEffect } from "react";
import { Mail, User, Users, Calendar, Bot, ExternalLink, Send, Loader2, Sparkles, ChevronUp, X, Clipboard, Check } from "lucide-react";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useEmailDraft, useAISettingsStore } from "@/stores/ai";
import type { AIMessageSource } from "@/lib/ai/types";
import { isTauri } from "@/lib/desk";
import type { IncomingEmail } from "@/lib/email/types";
import { formatEmailAddress, formatEmailDate } from "@/lib/email/types";
import { SourcesDisplay } from "@/components/ai/sources-display";

interface EmailViewerProps {
  email: IncomingEmail;
  onClose: () => void;
}

export function EmailViewer({ email, onClose }: EmailViewerProps) {
  // Draft reply state
  const [showDraft, setShowDraft] = useState(false);
  const [to, setTo] = useState(email.from.email);
  const [subject, setSubject] = useState(
    email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`
  );
  const [cc, setCc] = useState(email.cc?.map((c) => c.email).join(", ") || "");
  const [instructions, setInstructions] = useState("");
  const [draft, setDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sources, setSources] = useState<AIMessageSource[]>([]);

  const providerType = useAISettingsStore((state) => state.providerType);
  const emailDraft = useEmailDraft();

  // Reset draft fields when email changes
  useEffect(() => {
    setTo(email.from.email);
    setSubject(email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
    setCc(email.cc?.map((c) => c.email).join(", ") || "");
    setDraft("");
    setInstructions("");
    setError(null);
    setShowDraft(false);
    setSources([]);
  }, [email]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setDraft("");
    setError(null);
    setSources([]);

    try {
      const result = await emailDraft.mutateAsync({
        email,
        instructions: instructions || "Write a professional reply.",
      });

      if (result.draft) {
        setDraft(result.draft);
        setSources(result.sources);
      } else {
        setError("No response received from AI.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[email-viewer] Generation failed:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [email, instructions, emailDraft]);

  const handleSendViaMailClient = useCallback(async () => {
    const params: string[] = [];
    params.push(`subject=${encodeURIComponent(subject)}`);
    params.push(`body=${encodeURIComponent(draft)}`);
    if (cc.trim()) {
      params.push(`cc=${encodeURIComponent(cc)}`);
    }

    const mailto = `mailto:${encodeURIComponent(to)}?${params.join("&")}`;

    if (isTauri()) {
      try {
        await openUrl(mailto);
      } catch (err) {
        console.error("[email-viewer] Failed to open mail client:", err);
      }
    } else {
      window.location.href = mailto;
    }
  }, [to, subject, cc, draft]);

  const handleCopyForOutlook = useCallback(async (isReplyAll: boolean = false) => {
    if (!draft) return;

    try {
      // Add marker for Outlook add-in to detect reply type
      const marker = `<!-- DESK_REPLY:${isReplyAll ? "replyall" : "reply"} -->\n`;
      const textToCopy = marker + draft;

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);

      // Reset copied state after 3 seconds
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("[email-viewer] Failed to copy to clipboard:", err);
    }
  }, [draft]);

  const hasAIProvider = providerType !== null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
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
          {/* Email metadata */}
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

          {/* Email body */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Message</h2>
            <div className="p-4 rounded-lg border bg-card">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {email.body}
              </pre>
            </div>
          </div>

          {/* Actions */}
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

          {/* Inline Draft Section */}
          {showDraft && (
            <div className="p-4 rounded-lg border bg-muted/20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Draft Reply
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

              {/* Instructions */}
              <div className="space-y-2">
                <Label htmlFor="instructions" className="text-xs">Instructions (optional)</Label>
                <Input
                  id="instructions"
                  placeholder="e.g., be brief, decline politely, ask for more details..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  disabled={isGenerating}
                  className="text-sm"
                />
              </div>

              {/* Generate button */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !hasAIProvider}
                size="sm"
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
                <p className="text-xs text-muted-foreground">
                  Configure an AI provider in Settings to use this feature.
                </p>
              )}

              {/* Error display */}
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">
                    Failed to generate draft. Check Settings → AI.
                  </p>
                </div>
              )}

              {/* Email fields and draft - shown after generation */}
              {draft && (
                <div className="space-y-3 pt-3 border-t">
                  {/* Sources display */}
                  {sources.length > 0 && (
                    <SourcesDisplay
                      sources={sources}
                      label="Context used:"
                      className="px-1"
                    />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="to" className="text-xs">To</Label>
                      <Input
                        id="to"
                        type="email"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cc" className="text-xs">CC (optional)</Label>
                      <Input
                        id="cc"
                        value={cc}
                        onChange={(e) => setCc(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="subject" className="text-xs">Subject</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="draft" className="text-xs">Message</Label>
                    <Textarea
                      id="draft"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="space-y-2">
                    {/* Copy for Outlook - primary action for threading */}
                    <Button
                      onClick={() => handleCopyForOutlook(false)}
                      className="w-full"
                      variant={copied ? "outline" : "default"}
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied! Return to Outlook
                        </>
                      ) : (
                        <>
                          <Clipboard className="h-4 w-4 mr-2" />
                          Copy Draft for Outlook
                        </>
                      )}
                    </Button>

                    {/* Reply All option when CC recipients exist */}
                    {email.cc && email.cc.length > 0 && !copied && (
                      <Button
                        onClick={() => handleCopyForOutlook(true)}
                        variant="outline"
                        className="w-full"
                      >
                        <Clipboard className="h-4 w-4 mr-2" />
                        Copy Draft (Reply All)
                      </Button>
                    )}

                    {/* Fallback mailto option */}
                    <Button
                      onClick={handleSendViaMailClient}
                      variant="ghost"
                      className="w-full text-muted-foreground"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Open in Default Mail Client
                    </Button>
                  </div>

                  {/* Instructions for Outlook threading */}
                  <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">To insert as a threaded reply:</p>
                    <ol className="list-decimal list-inside space-y-0.5 ml-1">
                      <li>Click "Copy Draft for Outlook" above</li>
                      <li>In Outlook, click "Insert Reply from Desk"</li>
                      <li>Paste (Ctrl+V) and click Reply</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
