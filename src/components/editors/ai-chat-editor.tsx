import { useState, useRef, useEffect } from "react";
import {
  Send,
  MessageSquare,
  Mail,
  Loader2,
  StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/ai/chat-message";
import { ConversationList } from "@/components/ai/conversation-list";
import { SourcesDisplay } from "@/components/ai/sources-display";
import { useAssistantStore } from "@/stores/assistant";
import { useAISettingsStore } from "@/stores/ai";
import { useContextStore } from "@/stores/context";
import { buildAssistantPromptBreakdown, buildAssistantTurnUserMessage } from "@/lib/ai";
import type { AIMessageSource } from "@/lib/ai/types";
import type { AssistantToolEvent, AssistantTurnMode } from "@/lib/assistant/types";

const EMPTY_MESSAGES: import("@/lib/assistant/types").AssistantMessage[] = [];

const ASSISTANT_ACTIONS: Array<{ id: string; label: string; icon: typeof Mail; mode: AssistantTurnMode }> = [
  {
    id: "draft-email",
    label: "Draft Email",
    icon: Mail,
    mode: "draft-email",
  },
];

function inferContentType(path: string): "doc" | "task" | "meeting" {
  if (path.includes("/tasks/")) return "task";
  if (path.includes("/meetings/")) return "meeting";
  return "doc";
}

function getToolLabel(toolName: string): string {
  const labels: Record<string, string> = {
    desk_tree: "Browse workspace",
    desk_catalog: "Browse catalog",
    desk_read: "Read file",
    desk_search: "Search files",
    desk_workspace_info: "Get workspace info",
    desk_create_task: "Create task",
    desk_update_task: "Update task",
    desk_create_meeting: "Create meeting",
    desk_update_meeting: "Update meeting",
    desk_create_doc: "Create document",
    desk_update_doc: "Update document",
    web_search: "Web search",
  };
  return labels[toolName] || toolName.replaceAll("_", " ");
}

function extractSources(item: AssistantToolEvent): AIMessageSource[] {
  if (item.toolName !== "desk_read") return [];
  if (item.status !== "success") return [];
  if (!item.result || typeof item.result !== "object") return [];

  const result = item.result as { path?: string };
  if (typeof result.path !== "string") return [];

  const filename = result.path.split("/").pop() ?? result.path;
  const title = filename
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .replace(/\.md$/, "")
    .replace(/-/g, " ");

  return [{
    docPath: result.path,
    title,
    contentType: inferContentType(result.path),
  }];
}

function InlineToolActivity({
  items,
  showDetails,
}: {
  items: AssistantToolEvent[];
  showDetails: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const visibleItems = expanded ? items : items.slice(-3);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
    <div className="rounded-md border bg-muted/20 p-2 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Tool Activity</p>
        {hiddenCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Show less" : `Show ${hiddenCount} more`}
          </Button>
        )}
      </div>
      {visibleItems.map((item) => (
        <div key={item.id} className="text-xs rounded-md border bg-background/70 px-2 py-1.5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{getToolLabel(item.toolName)}</span>
            {item.status === "running" ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
            ) : (
              <span className="text-[11px] text-muted-foreground">{item.status}</span>
            )}
          </div>
          {extractSources(item).length > 0 && (
            <SourcesDisplay
              sources={extractSources(item)}
              label="File:"
              className="px-0.5"
            />
          )}
          {showDetails && (item.args !== undefined || item.result !== undefined) && (
            <>
              <details className="rounded bg-muted/40 p-1.5">
                <summary className="cursor-pointer text-[11px] text-muted-foreground">Details</summary>
                <div className="mt-1 space-y-1">
                  <p className="text-[11px] text-muted-foreground">Arguments</p>
                  <pre className="overflow-x-auto text-[11px]">{JSON.stringify(item.args, null, 2)}</pre>
                  {item.result !== undefined && (
                    <>
                      <p className="text-[11px] text-muted-foreground">Result</p>
                      <pre className="overflow-x-auto text-[11px]">{JSON.stringify(item.result, null, 2)}</pre>
                    </>
                  )}
                </div>
              </details>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function AIChatEditor() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversationId = useAssistantStore((s) => s.activeConversationId);
  const activeConversation = useAssistantStore(
    (s) => s.conversations.find((c) => c.id === s.activeConversationId) ?? null
  );
  const messages = useAssistantStore(
    (s) => s.conversations.find((c) => c.id === s.activeConversationId)?.messages ?? EMPTY_MESSAGES
  );
  const createConversation = useAssistantStore((s) => s.createConversation);
  const sendMessage = useAssistantStore((s) => s.sendMessage);
  const isRunning = useAssistantStore((s) => s.isRunning);
  const error = useAssistantStore((s) => s.error);
  const cancelRun = useAssistantStore((s) => s.cancelRun);
  const liveToolTimeline = useAssistantStore((s) => s.toolTimeline);

  const { providerType, providerConfigured, customInstructions, perTypeInstructions } = useAISettingsStore();
  const showToolDetails = useContextStore((s) => s.showToolDetails);
  const isConfigured = !!providerConfigured[providerType];
  const activeMode: AssistantTurnMode = activeConversation?.mode || "chat";
  const promptBreakdown = buildAssistantPromptBreakdown(
    activeMode,
    customInstructions,
    perTypeInstructions[activeMode]
  );

  // Show thinking bubble when running but no tools fired yet and no text streaming
  const lastMsg = messages[messages.length - 1];
  const showThinkingBubble =
    isRunning && lastMsg?.role === "assistant" && !lastMsg.content && liveToolTimeline.length === 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [activeConversationId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isRunning || !isConfigured) return;

    const next = input.trim();
    setInput("");
    await sendMessage(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleActionClick = async (action: typeof ASSISTANT_ACTIONS[number]) => {
    if (isRunning || !isConfigured) return;
    if (!activeConversationId) createConversation({ mode: action.mode });
    setInput("");
    await sendMessage(buildAssistantTurnUserMessage(action.mode), { mode: action.mode });
  };

  return (
    <div className="flex h-full bg-background">
      <ConversationList className="w-[240px] shrink-0" />

      <div className="flex flex-col flex-1 min-w-0">
        <ScrollArea className="flex-1 min-h-0">
          <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
            {!isConfigured && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Assistant is not configured. Open Settings → AI and add a provider key.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <details className="rounded-md border bg-muted/20 p-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Prompt in use ({activeMode === "draft-email" ? "Email Draft" : "Assistant"}): Effective Prompt
              </summary>
              <pre className="mt-2 rounded-md bg-background/70 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap font-mono">
                {promptBreakdown.effectivePrompt}
              </pre>
            </details>

            {messages.length === 0 ? (
              <div className="py-12">
                <EmptyState
                  title="Start with Desk Assistant"
                  description="Ask for analysis, context lookup, or task/doc/meeting updates. Assistant will use tools when needed."
                  icon={MessageSquare}
                />
                <div className="flex flex-wrap gap-2 justify-center mt-6">
                  {ASSISTANT_ACTIONS.map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <Button
                        key={action.id}
                        variant="default"
                        size="sm"
                        className="text-xs"
                        onClick={() => void handleActionClick(action)}
                        disabled={isRunning || !isConfigured}
                      >
                        <ActionIcon className="h-3.5 w-3.5 mr-1.5" />
                        {action.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((message, index) => (
                  <div key={message.id} className="space-y-2">
                    {message.role === "assistant" && message.toolEvents && message.toolEvents.length > 0 && (
                      <InlineToolActivity items={message.toolEvents} showDetails={showToolDetails} />
                    )}
                    {index === messages.length - 1 && isRunning && liveToolTimeline.length > 0 && (
                      <InlineToolActivity items={liveToolTimeline} showDetails={showToolDetails} />
                    )}
                    {!(index === messages.length - 1 && isRunning && !message.content) && (
                      <ChatMessage message={message} />
                    )}
                  </div>
                ))}
                {showThinkingBubble && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="rounded-lg px-3 py-2 text-sm bg-muted max-w-[80%]">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Thinking…</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t shrink-0 bg-background">
          <div className="max-w-2xl mx-auto px-6 py-4">
            <form onSubmit={handleSubmit}>
              <div className="rounded-lg border bg-background overflow-hidden transition-colors focus-within:border-ring/50">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Assistant… (Enter to send, Shift+Enter for newline)"
                  disabled={isRunning}
                  className="w-full min-h-[88px] max-h-[220px] resize-none text-sm border-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent rounded-none"
                  rows={3}
                />
                <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20">
                  {isRunning ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Working…</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/40">Enter to send</span>
                  )}
                  {isRunning ? (
                    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={cancelRun}>
                      <StopCircle className="h-3 w-3" />
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!input.trim() || !isConfigured}
                      className="h-7 gap-1.5 text-xs"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
