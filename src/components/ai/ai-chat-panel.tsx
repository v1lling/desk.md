"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Trash2, MessageSquare, FolderOpen, FileText, CheckSquare, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidePanel } from "@/components/ui/slide-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChatMessage } from "./chat-message";
import { useAIChatStore, useSendMessage, useAISettingsStore } from "@/stores/ai";
import { useSettingsStore } from "@/stores/settings";
import { useProjects } from "@/stores/projects";
import { useWorkspace } from "@/stores/workspaces";
import { useTabStore } from "@/stores/tabs";
import type { QueryContext } from "@/lib/rag/query-preprocessor";
import { parseDocPath, type AIMessageSource } from "@/lib/ai";

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
}

const ALL_CONTENT = "__all__";

export function AIChatPanel({ open, onClose }: AIChatPanelProps) {
  const [input, setInput] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(ALL_CONTENT);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Store
  const { messages, clearMessages, pendingSources } = useAIChatStore();
  const sendMessage = useSendMessage();
  const { providerType, anthropicApiKey } = useAISettingsStore();

  // Workspace and projects for context selector
  const currentWorkspaceId = useSettingsStore((s) => s.currentWorkspaceId);
  const { data: workspace } = useWorkspace(currentWorkspaceId);
  const { data: projects } = useProjects(currentWorkspaceId);
  const openTab = useTabStore((state) => state.openTab);

  const handleSourceClick = (source: AIMessageSource) => {
    const parsed = parseDocPath(source.docPath);
    if (!parsed) return;
    openTab({
      type: source.contentType,
      entityId: parsed.entityId,
      title: source.title,
      workspaceId: parsed.workspaceId,
    });
  };

  // Check if AI is properly configured
  const isConfigured = providerType === 'claude-code' ||
    (providerType === 'anthropic-api' && anthropicApiKey);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending || !isConfigured) return;

    // Build query context from selected project
    const actualProjectId = selectedProjectId === ALL_CONTENT ? null : selectedProjectId;
    const selectedProject = actualProjectId ? projects?.find((p) => p.id === actualProjectId) : null;
    const queryContext: QueryContext | undefined =
      actualProjectId && selectedProject
        ? {
            projectId: actualProjectId,
            projectName: selectedProject.name,
            workspaceId: currentWorkspaceId ?? undefined,
            workspaceName: workspace?.name,
          }
        : currentWorkspaceId && workspace
          ? {
              workspaceId: currentWorkspaceId,
              workspaceName: workspace.name,
            }
          : undefined;

    sendMessage.mutate({
      message: input.trim(),
      history: messages,
      queryContext,
    });

    setInput("");
  };

  const handleClear = () => {
    clearMessages();
  };

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="AI Chat"
      headerActions={
        messages.length > 0 ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="h-8 w-8"
            title="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : undefined
      }
      footer={
        <div className="space-y-2">
          {/* Project context selector */}
          {projects && projects.length > 0 && (
            <div className="flex items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="All content" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CONTENT}>All content</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Input form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              disabled={sendMessage.isPending}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || sendMessage.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      }
    >
      {/* Configuration warning */}
      {!isConfigured && (
        <div className="p-3 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-md">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            AI not configured. Go to Settings → AI to set up a provider.
          </p>
        </div>
      )}

      {/* Error display - keep generic, details in Settings */}
      {sendMessage.error && (
        <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">
            AI request failed. Check Settings → AI to test your connection.
          </p>
        </div>
      )}

      {messages.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Start a conversation with AI. Your docs are automatically included as context."
          icon={MessageSquare}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {sendMessage.isPending && (
            <div className="space-y-2">
              {/* Show pending sources while waiting */}
              {pendingSources && pendingSources.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-1">
                  <span className="text-xs text-muted-foreground">Using context:</span>
                  {pendingSources.map((source, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSourceClick(source)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 hover:bg-muted rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                      title={`Open ${source.title}`}
                    >
                      {source.contentType === 'task' ? (
                        <CheckSquare className="h-3 w-3" />
                      ) : source.contentType === 'meeting' ? (
                        <Calendar className="h-3 w-3" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                      <span className="max-w-[150px] truncate">{source.title}</span>
                      {source.score !== undefined && (
                        <span className="text-[10px] opacity-60">
                          {Math.round(source.score * 100)}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <LoadingState label="AI response" height="h-16" spinner />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </SlidePanel>
  );
}
