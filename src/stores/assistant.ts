import { create } from "zustand";
import { persist } from "zustand/middleware";
import { runAssistantTurn } from "@/lib/assistant/orchestrator";
import type {
  AssistantConversation,
  AssistantEvent,
  AssistantMessage,
  AssistantPendingApproval,
  AssistantTurnMode,
  AssistantToolEvent,
} from "@/lib/assistant/types";
import { useSettingsStore } from "@/stores/settings";
import { useAISettingsStore, useAIUsageStore } from "@/stores/ai";
import { DEFAULT_MODELS } from "@/lib/ai/models";
import { formatEmailAddress, type IncomingEmail } from "@/lib/email/types";
import { buildAssistantTurnUserMessage } from "@/lib/ai";

const MAX_CONVERSATIONS = 50;

interface AssistantState {
  conversations: AssistantConversation[];
  activeConversationId: string | null;

  isRunning: boolean;
  error: string | null;
  pendingApproval: AssistantPendingApproval | null;
  toolTimeline: AssistantToolEvent[];

  createConversation: (options?: { title?: string; workspaceId?: string | null; mode?: AssistantTurnMode }) => string;
  setActiveConversation: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  clearAllConversations: () => void;
  sendMessage: (
    message: string,
    options?: { mode?: AssistantTurnMode; forceNewConversation?: boolean; title?: string }
  ) => Promise<void>;
  startEmailDraft: (params: { email: IncomingEmail; instructions?: string }) => Promise<void>;
  approvePendingTool: () => void;
  rejectPendingTool: () => void;
  cancelRun: () => void;
}

let activeAbortController: AbortController | null = null;
let approvalResolver: ((approved: boolean) => void) | null = null;

export type { AssistantConversation };

function getActiveModel(): string {
  const settings = useAISettingsStore.getState();
  return settings.modelByProvider[settings.providerType] || DEFAULT_MODELS[settings.providerType];
}

function updateConversation(
  conversations: AssistantConversation[],
  conversationId: string,
  updater: (conversation: AssistantConversation) => AssistantConversation
): AssistantConversation[] {
  return conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;
    return updater(conversation);
  });
}

function appendMessage(
  conversation: AssistantConversation,
  message: AssistantMessage
): AssistantConversation {
  const messages = [...conversation.messages, message];
  let title = conversation.title;
  if (title === "New Assistant" && message.role === "user") {
    title = message.content.length > 50 ? `${message.content.slice(0, 50)}...` : message.content;
  }

  return {
    ...conversation,
    title,
    messages,
    updatedAt: new Date().toISOString(),
  };
}

function updateMessageContent(
  conversation: AssistantConversation,
  messageId: string,
  updater: (message: AssistantMessage) => AssistantMessage
): AssistantConversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) => (message.id === messageId ? updater(message) : message)),
    updatedAt: new Date().toISOString(),
  };
}

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      isRunning: false,
      error: null,
      pendingApproval: null,
      toolTimeline: [],

      createConversation: (options) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const workspaceId = options?.workspaceId ?? useSettingsStore.getState().currentWorkspaceId;

        const conversation: AssistantConversation = {
          id,
          title: options?.title || "New Assistant",
          mode: options?.mode || "chat",
          workspaceId,
          messages: [],
          createdAt: now,
          updatedAt: now,
        };

        set((state) => {
          const next = [conversation, ...state.conversations].slice(0, MAX_CONVERSATIONS);
          return {
            conversations: next,
            activeConversationId: id,
            error: null,
            pendingApproval: null,
            toolTimeline: [],
          };
        });

        return id;
      },

      setActiveConversation: (id) => set({ activeConversationId: id, error: null, pendingApproval: null, toolTimeline: [] }),

      deleteConversation: (id) =>
        set((state) => {
          const conversations = state.conversations.filter((conversation) => conversation.id !== id);
          return {
            conversations,
            activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
          };
        }),

      clearAllConversations: () => set({ conversations: [], activeConversationId: null }),

      sendMessage: async (message, options) => {
        const trimmed = message.trim();
        if (!trimmed || get().isRunning) return;

        let conversationId = get().activeConversationId;
        if (options?.forceNewConversation || !conversationId) {
          conversationId = get().createConversation({ title: options?.title, mode: options?.mode });
        }

        const baseConversation = get().conversations.find((item) => item.id === conversationId);
        if (!baseConversation) {
          set({ error: "Conversation not found." });
          return;
        }

        const mode = options?.mode || baseConversation.mode || "chat";

        const historyForModel = baseConversation.messages;
        const workspaceId = baseConversation.workspaceId ?? useSettingsStore.getState().currentWorkspaceId;
        if (!workspaceId) {
          set({ error: "No active workspace selected." });
          return;
        }

        const now = new Date().toISOString();
        const userMessage: AssistantMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: trimmed,
          timestamp: now,
        };
        const assistantMessageId = crypto.randomUUID();
        const assistantPlaceholder: AssistantMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          timestamp: now,
          toolEvents: [],
        };

        set((state) => ({
          conversations: updateConversation(state.conversations, conversationId!, (conversation) =>
            ({
              ...appendMessage(appendMessage(conversation, userMessage), assistantPlaceholder),
              mode,
            })
          ),
          isRunning: true,
          error: null,
          pendingApproval: null,
          toolTimeline: [],
        }));

        const aiSettings = useAISettingsStore.getState();
        activeAbortController = new AbortController();

        try {
          const result = await runAssistantTurn({
            message: trimmed,
            history: historyForModel,
            workspaceId,
            providerType: aiSettings.providerType,
            model: getActiveModel(),
            mode,
            maxSteps: 8,
            customInstructions: aiSettings.customInstructions,
            perAssistantInstructions: aiSettings.perTypeInstructions[mode],
            signal: activeAbortController.signal,
            onApprovalRequest: (request) => {
              return new Promise((resolve) => {
                approvalResolver = resolve;
                set({
                  pendingApproval: {
                    callId: request.callId,
                    toolName: request.toolName,
                    args: request.args,
                  },
                });
              });
            },
            onEvent: (event: AssistantEvent) => {
              if (event.type === "assistant_text_delta") {
                set((state) => ({
                  conversations: updateConversation(state.conversations, conversationId!, (conversationItem) =>
                    updateMessageContent(conversationItem, assistantMessageId, (message) => ({
                      ...message,
                      content: `${message.content}${event.text}`,
                    }))
                  ),
                }));
                return;
              }

              if (event.type === "tool_call_proposed") {
                set((state) => ({
                  toolTimeline: [
                    ...state.toolTimeline,
                    {
                      id: event.callId,
                      toolName: event.toolName,
                      args: event.args,
                      status: "proposed",
                    },
                  ],
                }));
                return;
              }

              if (event.type === "tool_call_waiting_approval") {
                set((state) => ({
                  toolTimeline: state.toolTimeline.map((item) =>
                    item.id === event.callId ? { ...item, status: "waiting_approval" } : item
                  ),
                }));
                return;
              }

              if (event.type === "tool_call_result") {
                set((state) => ({
                  pendingApproval:
                    state.pendingApproval?.callId === event.callId ? null : state.pendingApproval,
                  toolTimeline: state.toolTimeline.map((item) =>
                    item.id === event.callId
                      ? {
                          ...item,
                          status: event.ok ? "success" : "error",
                          result: event.result,
                        }
                      : item
                  ),
                }));
                return;
              }

              if (event.type === "assistant_error") {
                set({ error: event.message });
                return;
              }

              if (event.type === "assistant_cancelled") {
                set({ error: "Assistant run cancelled." });
                return;
              }

              if (event.type === "assistant_done") {
                if (event.usage) {
                  useAIUsageStore.getState().addRecord({
                    purpose: mode,
                    provider: aiSettings.providerType,
                    usage: event.usage,
                  });
                }
              }
            },
          });

          set((state) => ({
            conversations: updateConversation(state.conversations, conversationId!, (conversationItem) =>
              updateMessageContent(conversationItem, assistantMessageId, (message) => ({
                ...message,
                content: message.content || result.text,
                toolEvents: state.toolTimeline,
              }))
            ),
            isRunning: false,
            pendingApproval: null,
            toolTimeline: [],
          }));
        } catch (error) {
          if (activeAbortController?.signal.aborted) {
            set((state) => ({
              conversations: updateConversation(state.conversations, conversationId!, (conversationItem) => ({
                ...conversationItem,
                messages: conversationItem.messages.filter(
                  (message) => !(message.id === assistantMessageId && !message.content.trim())
                ),
              })),
              isRunning: false,
              pendingApproval: null,
            }));
          } else {
            set((state) => ({
              conversations: updateConversation(state.conversations, conversationId!, (conversationItem) => ({
                ...conversationItem,
                messages: conversationItem.messages.filter(
                  (message) => !(message.id === assistantMessageId && !message.content.trim())
                ),
              })),
              isRunning: false,
              pendingApproval: null,
              error: String(error),
            }));
          }
        } finally {
          activeAbortController = null;
          approvalResolver = null;
        }
      },

      startEmailDraft: async ({ email, instructions }) => {
        const titleBase = email.subject?.trim() ? `Draft: ${email.subject.trim()}` : "Draft Email Reply";
        const prompt = buildAssistantTurnUserMessage("draft-email", {
          emailContext: {
            from: formatEmailAddress(email.from),
            to: email.to?.map(formatEmailAddress).join(", ") || "",
            cc: email.cc?.map(formatEmailAddress).join(", ") || "",
            subject: email.subject || "",
            date: email.date || "",
            source: email.source || "",
            body: email.body || "",
            instructions: instructions?.trim() || "",
          },
        });
        await get().sendMessage(prompt, {
          mode: "draft-email",
          forceNewConversation: true,
          title: titleBase.length > 80 ? `${titleBase.slice(0, 80)}...` : titleBase,
        });
      },

      approvePendingTool: () => {
        if (!approvalResolver) return;
        const resolver = approvalResolver;
        approvalResolver = null;
        set({ pendingApproval: null });
        resolver(true);
      },

      rejectPendingTool: () => {
        if (!approvalResolver) return;
        const resolver = approvalResolver;
        approvalResolver = null;
        set({ pendingApproval: null });
        resolver(false);
      },

      cancelRun: () => {
        if (approvalResolver) {
          const resolver = approvalResolver;
          approvalResolver = null;
          resolver(false);
        }

        if (activeAbortController) {
          activeAbortController.abort();
          activeAbortController = null;
        }

        set({
          isRunning: false,
          pendingApproval: null,
        });
      },
    }),
    {
      name: "desk-assistant",
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
      }),
    }
  )
);
