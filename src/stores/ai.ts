import { useMutation } from '@tanstack/react-query';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createAIService,
  type AIMessage,
  type AIMessageSource,
  type AIContext,
  type AIProviderType,
  type AIPurpose,
  type AIUsage,
  type AIUsageRecord,
  type AIContextResult,
  type AIServiceResponse,
} from '@/lib/ai';
import { formatEmailAddress, type IncomingEmail } from '@/lib/email/types';
import { useSettingsStore } from '@/stores/settings';
import { useWorkspaces } from '@/stores/workspaces';
import { useContextSearch } from '@/hooks/use-context-search';

// =============================================================================
// AI Settings Store (persisted)
// =============================================================================

interface AISettingsState {
  providerType: AIProviderType;
  anthropicApiKey: string;
  customInstructions: string;
  setProviderType: (type: AIProviderType) => void;
  setAnthropicApiKey: (key: string) => void;
  setCustomInstructions: (instructions: string) => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      providerType: 'claude-code',
      anthropicApiKey: '',
      customInstructions: '',
      setProviderType: (type) => set({ providerType: type }),
      setAnthropicApiKey: (key) => set({ anthropicApiKey: key }),
      setCustomInstructions: (instructions) => set({ customInstructions: instructions }),
    }),
    {
      name: 'desk-ai-settings',
    }
  )
);

// =============================================================================
// AI Usage Store (persisted)
// =============================================================================

interface AIUsageState {
  records: AIUsageRecord[];
  addRecord: (record: Omit<AIUsageRecord, 'id' | 'timestamp'>) => void;
  clearRecords: () => void;
  getStats: () => {
    totalTokens: number;
    totalRequests: number;
    byProvider: Record<string, { tokens: number; requests: number }>;
  };
}

export const useAIUsageStore = create<AIUsageState>()(
  persist(
    (set, get) => ({
      records: [],
      addRecord: (record) =>
        set((state) => ({
          records: [
            ...state.records,
            {
              ...record,
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
            },
          ],
        })),
      clearRecords: () => set({ records: [] }),
      getStats: () => {
        const records = get().records;
        const byProvider: Record<string, { tokens: number; requests: number }> = {};

        let totalTokens = 0;
        for (const record of records) {
          totalTokens += record.usage.totalTokens;

          if (!byProvider[record.provider]) {
            byProvider[record.provider] = { tokens: 0, requests: 0 };
          }
          byProvider[record.provider].tokens += record.usage.totalTokens;
          byProvider[record.provider].requests += 1;
        }

        return {
          totalTokens,
          totalRequests: records.length,
          byProvider,
        };
      },
    }),
    {
      name: 'desk-ai-usage',
    }
  )
);

// =============================================================================
// AI Chat Store (persisted - conversation history)
// =============================================================================

const MAX_CONVERSATIONS = 50;

export interface Conversation {
  id: string;
  title: string;
  /** Workspace active when conversation was started */
  workspaceId: string | null;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

interface AIChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  /** Sources found by context search, shown while waiting for AI response */
  pendingSources: AIMessageSource[] | null;

  // Actions
  createConversation: () => string;
  setActiveConversation: (id: string | null) => void;
  addMessage: (msg: AIMessage) => void;
  deleteConversation: (id: string) => void;
  clearAllConversations: () => void;
  setPendingSources: (sources: AIMessageSource[] | null) => void;
}

export const useAIChatStore = create<AIChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      pendingSources: null,

      createConversation: () => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const workspaceId = useSettingsStore.getState().currentWorkspaceId;

        const newConversation: Conversation = {
          id,
          title: 'New Chat',
          workspaceId,
          messages: [],
          createdAt: now,
          updatedAt: now,
        };

        set((state) => {
          // Prune oldest if at capacity
          let conversations = [newConversation, ...state.conversations];
          if (conversations.length > MAX_CONVERSATIONS) {
            conversations = conversations.slice(0, MAX_CONVERSATIONS);
          }
          return {
            conversations,
            activeConversationId: id,
            pendingSources: null,
          };
        });

        return id;
      },

      setActiveConversation: (id) => set({ activeConversationId: id, pendingSources: null }),

      addMessage: (msg) =>
        set((state) => {
          let { activeConversationId, conversations } = state;

          // Auto-create conversation if none active
          if (!activeConversationId) {
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            const workspaceId = useSettingsStore.getState().currentWorkspaceId;
            const newConv: Conversation = {
              id,
              title: 'New Chat',
              workspaceId,
              messages: [],
              createdAt: now,
              updatedAt: now,
            };
            activeConversationId = id;
            conversations = [newConv, ...conversations];
            if (conversations.length > MAX_CONVERSATIONS) {
              conversations = conversations.slice(0, MAX_CONVERSATIONS);
            }
          }

          return {
            activeConversationId,
            conversations: conversations.map((c) => {
              if (c.id !== activeConversationId) return c;

              const updatedMessages = [...c.messages, msg];
              // Auto-title from first user message
              let title = c.title;
              if (title === 'New Chat' && msg.role === 'user') {
                title = msg.content.length > 50
                  ? msg.content.slice(0, 50) + '...'
                  : msg.content;
              }

              return {
                ...c,
                messages: updatedMessages,
                title,
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      deleteConversation: (id) =>
        set((state) => {
          const conversations = state.conversations.filter((c) => c.id !== id);
          const activeConversationId =
            state.activeConversationId === id ? null : state.activeConversationId;
          return { conversations, activeConversationId, pendingSources: null };
        }),

      clearAllConversations: () =>
        set({ conversations: [], activeConversationId: null, pendingSources: null }),

      setPendingSources: (sources) => set({ pendingSources: sources }),
    }),
    {
      name: 'desk-ai-chat',
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
      }),
    }
  )
);

// =============================================================================
// AI Hooks
// =============================================================================
//
// Three hooks for different use cases:
// - useAIService(): Internal - returns raw AIService instance
// - useSendMessage(): For chat panel - manages conversation history in store
// - useAIAction(): For one-off operations - email drafts, summaries, etc.
//

/**
 * Internal: Get a configured AI service instance
 */
function useAIService() {
  const { providerType, anthropicApiKey } = useAISettingsStore();
  const { addRecord } = useAIUsageStore();

  return createAIService({
    providerType,
    apiKey: providerType === 'anthropic-api' ? anthropicApiKey : undefined,
    onUsage: (usage: AIUsage, purpose: AIPurpose, provider: AIProviderType) => {
      addRecord({ purpose, provider, usage });
    },
  });
}

/**
 * Hook to send a chat message (for the chat panel)
 * Automatically includes context based on the selected strategy (index, rag, or none)
 */
export function useSendMessage() {
  const { addMessage, setPendingSources } = useAIChatStore();
  const { providerType, anthropicApiKey, customInstructions } = useAISettingsStore();
  const { addRecord } = useAIUsageStore();
  const { search: contextSearch } = useContextSearch();
  const { data: workspaces = [] } = useWorkspaces();

  return useMutation({
    mutationFn: async ({
      message,
      context,
      history,
    }: {
      message: string;
      context?: AIContext;
      history?: AIMessage[];
    }): Promise<{ response: AIServiceResponse; sources?: AIMessageSource[] }> => {
      // Perform context search (strategy-aware: index, rag, or none)
      let contextResults: AIContextResult[] = [];
      let sources: AIMessageSource[] | undefined;

      const currentWorkspaceId = useSettingsStore.getState().currentWorkspaceId;
      const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);

      try {
        const result = await contextSearch({
          query: message,
          workspaceId: currentWorkspaceId ?? undefined,
        });
        contextResults = result.contextResults;
        if (result.sources.length > 0) {
          // Attach workspace info to each source for history transparency
          sources = result.sources.map((s) => ({
            ...s,
            workspaceId: currentWorkspaceId ?? undefined,
            workspaceName: currentWorkspace?.name,
          }));
          setPendingSources(sources);
        }
      } catch (error) {
        console.warn('[AI] Context search failed:', error);
      }

      // Merge results with existing context
      const enrichedContext: AIContext = {
        ...context,
        contextResults: contextResults.length > 0 ? contextResults : undefined,
      };

      const service = createAIService({
        providerType,
        apiKey: providerType === 'anthropic-api' ? anthropicApiKey : undefined,
        onUsage: (usage, purpose, provider) => {
          addRecord({ purpose, provider, usage });
        },
      });

      const response = await service.chat(message, {
        context: enrichedContext,
        history,
        userInstructions: customInstructions || undefined,
      });
      return { response, sources };
    },
    onMutate: ({ message }) => {
      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      });
    },
    onSuccess: ({ response, sources }) => {
      setPendingSources(null);
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        sources,
      });
    },
    onError: () => {
      setPendingSources(null);
    },
  });
}

/**
 * Hook for quick AI actions (draft email, summarize, etc.)
 */
export function useAIAction() {
  const service = useAIService();

  return {
    draftEmail: service.draftEmail.bind(service),
    summarize: service.summarize.bind(service),
    findTasks: service.findTasks.bind(service),
    explain: service.explain.bind(service),
    custom: service.custom.bind(service),
  };
}

// =============================================================================
// Email Draft Hook (with Context Retrieval)
// =============================================================================

export interface EmailDraftOptions {
  /** The incoming email to reply to */
  email: IncomingEmail;
  /** User's instructions for the reply */
  instructions: string;
  /** Workspace ID for context retrieval */
  workspaceId?: string;
}

export interface EmailDraftResult {
  /** Generated draft text */
  draft: string;
  /** Sources used for context */
  sources: AIMessageSource[];
}

/**
 * Hook for drafting email replies with automatic context retrieval.
 * Uses the active context strategy (index, rag, or none) to find relevant docs.
 */
export function useEmailDraft() {
  const service = useAIService();
  const { search: contextSearch } = useContextSearch();

  return useMutation({
    mutationFn: async (options: EmailDraftOptions): Promise<EmailDraftResult> => {
      let sources: AIMessageSource[] = [];
      let contextResults: AIContextResult[] = [];

      // Build a query from the email content
      const query = `${options.email.subject} ${options.email.body.slice(0, 300)}`;
      const workspaceId = options.workspaceId ?? useSettingsStore.getState().currentWorkspaceId ?? undefined;

      try {
        const result = await contextSearch({ query, workspaceId });
        sources = result.sources;
        contextResults = result.contextResults;
      } catch (error) {
        console.warn('[useEmailDraft] Context search failed:', error);
      }

      const response = await service.draftEmail(
        {
          from: formatEmailAddress(options.email.from),
          subject: options.email.subject,
          body: options.email.body,
        },
        options.instructions || 'Write a professional reply.',
        { context: contextResults.length > 0 ? { contextResults } : undefined }
      );

      return {
        draft: response.message,
        sources,
      };
    },
  });
}
