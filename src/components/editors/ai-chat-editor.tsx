"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Trash2, MessageSquare, FolderOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChatMessage } from "@/components/ai/chat-message";
import { SourcesDisplay } from "@/components/ai/sources-display";
import { useAIChatStore, useSendMessage, useAISettingsStore } from "@/stores/ai";
import { useSettingsStore } from "@/stores/settings";
import { useProjects } from "@/stores/projects";
import { useWorkspace } from "@/stores/workspaces";
import type { QueryContext } from "@/lib/rag/query-preprocessor";

interface AIChatEditorProps {
  onClose: () => void;
}

const ALL_CONTENT = "__all__";

export function AIChatEditor({ onClose }: AIChatEditorProps) {
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

  // Check if AI is properly configured
  const isConfigured = providerType === 'claude-code' ||
    (providerType === 'anthropic-api' && anthropicApiKey);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

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
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">AI Chat</h2>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 px-2 text-muted-foreground"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages area - centered narrow layout */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {/* Configuration warning */}
          {!isConfigured && (
            <div className="p-3 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-md">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                AI not configured. Go to Settings → AI to set up a provider.
              </p>
            </div>
          )}

          {/* Error display */}
          {sendMessage.error && (
            <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">
                AI request failed. Check Settings → AI to test your connection.
              </p>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="py-12">
              <EmptyState
                title="No messages yet"
                description="Start a conversation with AI. Your docs are automatically included as context."
                icon={MessageSquare}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {sendMessage.isPending && (
                <div className="space-y-2">
                  {/* Show pending sources while waiting */}
                  {pendingSources && pendingSources.length > 0 && (
                    <SourcesDisplay
                      sources={pendingSources}
                      label="Using context:"
                      className="px-1"
                    />
                  )}
                  <LoadingState label="AI response" height="h-16" spinner />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area - fixed at bottom, centered */}
      <div className="border-t shrink-0">
        <div className="max-w-2xl mx-auto px-6 py-4 space-y-2">
          {/* Project context selector */}
          {projects && projects.length > 0 && (
            <div className="flex items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
              >
                <SelectTrigger className="h-7 text-xs w-[200px]">
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
      </div>
    </div>
  );
}
