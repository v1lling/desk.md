import { useMutation } from '@tanstack/react-query';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createAIService,
  type AIMessage,
  type AIContext,
  type AIProviderType,
  type AIPurpose,
  type AIUsage,
  type AIUsageRecord,
} from '@/lib/ai';

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
      name: 'orbit-ai-settings',
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
      name: 'orbit-ai-usage',
    }
  )
);

// =============================================================================
// AI Chat Store (session only - not persisted)
// =============================================================================

interface AIChatState {
  messages: AIMessage[];
  selectedDocs: string[];
  addMessage: (msg: AIMessage) => void;
  clearMessages: () => void;
  setSelectedDocs: (ids: string[]) => void;
  toggleDoc: (id: string) => void;
}

export const useAIChatStore = create<AIChatState>((set) => ({
  messages: [],
  selectedDocs: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  clearMessages: () => set({ messages: [], selectedDocs: [] }),
  setSelectedDocs: (ids) => set({ selectedDocs: ids }),
  toggleDoc: (id) =>
    set((s) => ({
      selectedDocs: s.selectedDocs.includes(id)
        ? s.selectedDocs.filter((d) => d !== id)
        : [...s.selectedDocs, id],
    })),
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
 */
export function useSendMessage() {
  const { addMessage } = useAIChatStore();
  const { providerType, anthropicApiKey } = useAISettingsStore();
  const { addRecord } = useAIUsageStore();

  return useMutation({
    mutationFn: async ({
      message,
      context,
      history,
    }: {
      message: string;
      context?: AIContext;
      history?: AIMessage[];
    }) => {
      const service = createAIService({
        providerType,
        apiKey: providerType === 'anthropic-api' ? anthropicApiKey : undefined,
        onUsage: (usage, purpose, provider) => {
          addRecord({ purpose, provider, usage });
        },
      });

      return service.chat(message, { context, history });
    },
    onMutate: ({ message }) => {
      // Optimistically add user message
      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      });
    },
    onSuccess: (response) => {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
      });
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
