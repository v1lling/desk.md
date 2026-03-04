
import { useState, useRef, useEffect } from "react";
import { Send, MessageSquare, X, PanelLeftClose, PanelLeft, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/ai/chat-message";
import { SourcesDisplay } from "@/components/ai/sources-display";
import { ConversationList } from "@/components/ai/conversation-list";
import { useAIChatStore, useSendMessage, useAISettingsStore } from "@/stores/ai";
import { useCurrentWorkspace } from "@/stores/workspaces";

const DEFAULT_WORKSPACE_COLOR = "#64748b";
const EMPTY_MESSAGES: import("@/lib/ai/types").AIMessage[] = [];

interface AIChatEditorProps {
  onClose: () => void;
}

const SUGGESTED_PROMPTS = [
  "Summarize my active tasks",
  "What's the status of my projects?",
  "Draft a status update",
];

export function AIChatEditor({ onClose }: AIChatEditorProps) {
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Store
  const activeConversationId = useAIChatStore((s) => s.activeConversationId);
  const messages = useAIChatStore(
    (s) => s.conversations.find((c) => c.id === s.activeConversationId)?.messages ?? EMPTY_MESSAGES
  );
  const pendingSources = useAIChatStore((s) => s.pendingSources);
  const createConversation = useAIChatStore((s) => s.createConversation);
  const sendMessage = useSendMessage();
  const { providerType, anthropicApiKey } = useAISettingsStore();

  // Workspace context indicator
  const currentWorkspace = useCurrentWorkspace();
  const workspaceColor = currentWorkspace?.color || DEFAULT_WORKSPACE_COLOR;
  const workspaceName = currentWorkspace?.name || "No workspace";

  // Check if AI is properly configured
  const isConfigured = providerType === 'claude-code' ||
    (providerType === 'anthropic-api' && anthropicApiKey);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus textarea on mount and when conversation changes
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [activeConversationId]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || sendMessage.isPending || !isConfigured) return;

    sendMessage.mutate({
      message: input.trim(),
      history: messages,
    });

    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds newline
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    if (!activeConversationId) {
      createConversation();
    }
    setInput(prompt);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  return (
    <div className="flex h-full bg-background">
      {/* Conversation history panel */}
      {showHistory && (
        <ConversationList className="w-[220px] shrink-0" />
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(!showHistory)}
              className="h-7 w-7 text-muted-foreground"
              title={showHistory ? "Hide history" : "Show history"}
            >
              {showHistory ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
            <h2 className="text-base font-semibold">AI Chat</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Workspace context badge */}
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground"
              title="AI retrieves context from this workspace"
            >
              <Circle
                className="size-2 shrink-0"
                style={{ color: workspaceColor }}
                fill={workspaceColor}
              />
              <span className="max-w-[120px] truncate">{workspaceName}</span>
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
        </div>

        {/* Messages area - centered narrow layout */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="max-w-2xl mx-auto px-6 py-6">
            {/* Configuration warning */}
            {!isConfigured && (
              <div className="p-3 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-md">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  AI not configured. Go to Settings &rarr; AI to set up a provider.
                </p>
              </div>
            )}

            {/* Error display */}
            {sendMessage.error && (
              <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">
                  AI request failed. Check Settings &rarr; AI to test your connection.
                </p>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  title="Start a conversation"
                  description={`Ask anything about your ${workspaceName} workspace. Docs, tasks, and meetings are automatically included as context.`}
                  icon={MessageSquare}
                />
                {/* Suggested prompts */}
                <div className="flex flex-wrap gap-2 justify-center mt-6">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <Button
                      key={prompt}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleSuggestionClick(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
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
          <div className="max-w-2xl mx-auto px-6 py-4">
            <form onSubmit={handleSubmit} className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything... (Enter to send, Shift+Enter for newline)"
                disabled={sendMessage.isPending}
                className="flex-1 min-h-[40px] max-h-[120px] resize-none text-sm"
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || sendMessage.isPending}
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
