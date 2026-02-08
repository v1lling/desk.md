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
import { useContextSearch } from '@/hooks/use-context-search';

// =============================================================================
// AI Settings Store (persisted)
// =============================================================================

interface AISettingsState {
  providerType: AIProviderType;
  anthropicApiKey: string;
  setProviderType: (type: AIProviderType) => void;
  setAnthropicApiKey: (key: string) => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      providerType: 'claude-code',
      anthropicApiKey: '',
      setProviderType: (type) => set({ providerType: type }),
      setAnthropicApiKey: (key) => set({ anthropicApiKey: key }),
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
// AI Chat Store (session only - not persisted)
// =============================================================================

interface AIChatState {
  messages: AIMessage[];
  /** Sources found by context search, shown while waiting for AI response */
  pendingSources: AIMessageSource[] | null;
  addMessage: (msg: AIMessage) => void;
  clearMessages: () => void;
  setPendingSources: (sources: AIMessageSource[] | null) => void;
}

export const useAIChatStore = create<AIChatState>((set) => ({
  messages: [],
  pendingSources: null,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  clearMessages: () => set({ messages: [], pendingSources: null }),
  setPendingSources: (sources) => set({ pendingSources: sources }),
}));

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
  const { providerType, anthropicApiKey } = useAISettingsStore();
  const { addRecord } = useAIUsageStore();
  const { search: contextSearch } = useContextSearch();

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

      try {
        const result = await contextSearch({
          query: message,
          workspaceId: currentWorkspaceId ?? undefined,
        });
        contextResults = result.contextResults;
        if (result.sources.length > 0) {
          sources = result.sources;
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

      const response = await service.chat(message, { context: enrichedContext, history });
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
