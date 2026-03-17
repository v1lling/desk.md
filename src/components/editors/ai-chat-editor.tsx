import { useState, useRef, useEffect } from "react";
import {
  Send,
  MessageSquare,
  Mail,
  Loader2,
  Check,
  Ban,
  StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
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
    desk_index_search: "Find relevant files",
    desk_read: "Read file",
    desk_search: "Search files",
    desk_list: "List files",
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
  if (item.toolName !== "desk_index_search") return [];
  if (!item.result || typeof item.result !== "object") return [];

  const result = item.result as {
    workspace_id?: string;
    results?: Array<{ path?: string; title?: string; score?: number }>;
  };
  if (!Array.isArray(result.results)) return [];
  const numericScores = result.results
    .map((entry) => (typeof entry.score === "number" ? entry.score : 0))
    .filter((score) => score > 0);
  const maxScore = numericScores.length > 0 ? Math.max(...numericScores) : 1;

  return result.results
    .filter((entry) => typeof entry.path === "string" && typeof entry.title === "string")
    .map((entry) => ({
      docPath: entry.path as string,
      title: entry.title as string,
      contentType: inferContentType(entry.path as string),
      score: typeof entry.score === "number" ? entry.score / maxScore : undefined,
      workspaceId: typeof result.workspace_id === "string" ? result.workspace_id : undefined,
    }));
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
            <span className="text-[11px] text-muted-foreground">{item.status.replace("_", " ")}</span>
          </div>
          {extractSources(item).length > 0 && (
            <SourcesDisplay
              sources={extractSources(item)}
              label="Files:"
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
  const pendingApproval = useAssistantStore((s) => s.pendingApproval);
  const approvePendingTool = useAssistantStore((s) => s.approvePendingTool);
  const rejectPendingTool = useAssistantStore((s) => s.rejectPendingTool);
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
        <PageHeader title="Assistant" density="regular" />

        <div className="px-6 pt-3 shrink-0">
          {isRunning && (
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={cancelRun}>
              <StopCircle className="h-3 w-3" />
              Cancel
            </Button>
          )}
        </div>

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
                    <ChatMessage message={message} />
                    {index === messages.length - 1 && isRunning && liveToolTimeline.length > 0 && (
                      <InlineToolActivity items={liveToolTimeline} showDetails={showToolDetails} />
                    )}
                  </div>
                ))}
                {isRunning && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="rounded-lg px-3 py-2 text-sm bg-muted max-w-[80%]">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Thinking...</span>
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
            {pendingApproval && (
              <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-3 space-y-2 mb-3">
                <p className="text-sm font-medium">Approval required: {pendingApproval.toolName}</p>
                <pre className="text-xs bg-background/70 rounded p-2 overflow-x-auto max-h-40">
{JSON.stringify(pendingApproval.args, null, 2)}
                </pre>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="h-7 gap-1" onClick={approvePendingTool}>
                    <Check className="h-3 w-3" />
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={rejectPendingTool}>
                    <Ban className="h-3 w-3" />
                    Reject
                  </Button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2 items-end">
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Assistant... (Enter to send, Shift+Enter for newline)"
                  disabled={isRunning}
                  className="w-full min-h-[88px] max-h-[220px] resize-none text-sm"
                  rows={3}
                />
              </div>
              <Button type="submit" size="icon" disabled={!input.trim() || isRunning} className="shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
