"use client";

import { useState, useMemo } from "react";
import { Mail, User, Users, Calendar, Building2, Bot, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaces, useProjects } from "@/stores";
import type { IncomingEmail } from "@/lib/email/types";
import { formatEmailAddress, formatEmailDate } from "@/lib/email/types";
import { DraftReplyPanel } from "./draft-reply-panel";

interface EmailViewerProps {
  email: IncomingEmail;
  onClose: () => void;
}

export function EmailViewer({ email, onClose }: EmailViewerProps) {
  const { data: workspaces = [] } = useWorkspaces();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [showDraftPanel, setShowDraftPanel] = useState(false);

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
              <Select value={selectedWorkspaceId} onValueChange={(v) => {
                setSelectedWorkspaceId(v);
                setSelectedProjectId(""); // Reset project when workspace changes
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
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
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Workspace level</SelectItem>
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
            <Button onClick={() => setShowDraftPanel(true)}>
              <Bot className="h-4 w-4 mr-2" />
              Draft Reply
            </Button>
            <Button variant="outline" disabled>
              <ExternalLink className="h-4 w-4 mr-2" />
              Extract Tasks
              <span className="ml-2 text-xs text-muted-foreground">(coming soon)</span>
            </Button>
          </div>
        </div>
      </ScrollArea>

      {/* Draft Reply Panel */}
      <DraftReplyPanel
        open={showDraftPanel}
        onOpenChange={setShowDraftPanel}
        email={email}
        workspaceId={selectedWorkspaceId}
        projectId={selectedProjectId}
      />
    </div>
  );
}
