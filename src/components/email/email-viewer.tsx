"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Mail, User, Users, Calendar, Building2, Bot, ExternalLink, Send, Loader2, Sparkles, ChevronDown, ChevronUp, X } from "lucide-react";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaces, useProjects } from "@/stores";
import { useAIAction, useAISettingsStore } from "@/stores/ai";
import { isTauri } from "@/lib/desk";
import type { IncomingEmail } from "@/lib/email/types";
import { formatEmailAddress, formatEmailDate } from "@/lib/email/types";

interface EmailViewerProps {
  email: IncomingEmail;
  onClose: () => void;
}

export function EmailViewer({ email, onClose }: EmailViewerProps) {
  const { data: workspaces = [] } = useWorkspaces();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

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

  const providerType = useAISettingsStore((state) => state.providerType);
  const { draftEmail } = useAIAction();

  // Get projects for selected workspace
  const { data: projects = [] } = useProjects(selectedWorkspaceId || null);

  // Build workspace options
  const workspaceOptions = useMemo(() => {
    return workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      color: w.color,
    }));
  }, [workspaces]);

  // Build project options
  const projectOptions = useMemo(() => {
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
    }));
  }, [projects]);

  // Reset draft fields when email changes
  useEffect(() => {
    setTo(email.from.email);
    setSubject(email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
    setCc(email.cc?.map((c) => c.email).join(", ") || "");
    setDraft("");
    setInstructions("");
    setError(null);
    setShowDraft(false);
  }, [email]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setDraft("");
    setError(null);

    try {
      const response = await draftEmail(
        {
          from: formatEmailAddress(email.from),
          subject: email.subject,
          body: email.body,
        },
        instructions || "Write a professional reply."
      );

      if (response?.message) {
        setDraft(response.message);
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
  }, [email, instructions, draftEmail]);

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

          {/* Project linking */}
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4" />
              Link to Project (for AI context)
            </div>
            <div className="flex gap-2">
              <Select value={selectedWorkspaceId || "_none"} onValueChange={(v) => {
                setSelectedWorkspaceId(v === "_none" ? "" : v);
                setSelectedProjectId("");
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {workspaceOptions.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: w.color }}
                        />
                        {w.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedWorkspaceId && (
                <Select value={selectedProjectId || "_none"} onValueChange={(v) => setSelectedProjectId(v === "_none" ? "" : v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Workspace level</SelectItem>
                    {projectOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
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

                  <Button onClick={handleSendViaMailClient} className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    Open in Mail Client
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Opens your default mail app with the draft pre-filled
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
