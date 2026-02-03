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
  type AIRAGResult,
  type AIServiceResponse,
} from '@/lib/ai';
import { formatEmailAddress, type IncomingEmail } from '@/lib/email/types';
import * as rag from '@/lib/rag';
import {
  preprocessQuery,
  buildEmailPrequery,
  type QueryContext,
} from '@/lib/rag/query-preprocessor';
import { deduplicateByDocPath } from '@/lib/rag/utils';
import { useRAGStore } from '@/stores/rag';
import { useSettingsStore } from '@/stores/settings';
import { isTauri } from '@/lib/desk';
import { useRAGSearch } from '@/hooks/use-rag-search';

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
  /** Sources found by RAG, shown while waiting for AI response */
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
 * Automatically includes RAG context if enabled
 */
export function useSendMessage() {
  const { addMessage, setPendingSources } = useAIChatStore();
  const { providerType, anthropicApiKey } = useAISettingsStore();
  const { addRecord } = useAIUsageStore();

  // RAG settings - read from store state directly in mutationFn
  // to avoid stale closures
  const getRAGSettings = () => {
    const ragState = useRAGStore.getState();
    const settingsState = useSettingsStore.getState();
    return {
      dataPath: settingsState.dataPath,
      embeddingProvider: ragState.embeddingProvider,
      ollamaUrl: ragState.ollamaUrl,
      ollamaModel: ragState.ollamaModel,
      openaiApiKey: ragState.openaiApiKey,
      voyageApiKey: ragState.voyageApiKey,
      retrievalCount: ragState.retrievalCount,
      scoreThreshold: ragState.scoreThreshold,
      showSourcesInChat: ragState.showSourcesInChat,
    };
  };

  return useMutation({
    mutationFn: async ({
      message,
      context,
      history,
      queryContext,
    }: {
      message: string;
      context?: AIContext;
      history?: AIMessage[];
      /** Optional context for RAG query preprocessing (selected project/workspace) */
      queryContext?: QueryContext;
    }): Promise<{ response: AIServiceResponse; sources?: AIMessageSource[] }> => {
      // Get RAG settings
      const ragSettings = getRAGSettings();

      // Perform RAG search if we're in Tauri and have a data path
      let ragResults: AIRAGResult[] = [];
      let sources: AIMessageSource[] | undefined;

      if (isTauri() && ragSettings.dataPath) {
        try {
          const settings: rag.EmbeddingSettings = {
            provider: ragSettings.embeddingProvider,
            ollamaUrl: ragSettings.ollamaUrl,
            ollamaModel: ragSettings.ollamaModel,
            openaiApiKey: ragSettings.openaiApiKey || undefined,
            voyageApiKey: ragSettings.voyageApiKey || undefined,
          };

          // Preprocess query with context for better retrieval
          const enhancedQuery = preprocessQuery(message, queryContext);

          const results = await rag.search(
            ragSettings.dataPath,
            enhancedQuery,
            ragSettings.retrievalCount,
            settings
          );

          // Filter by score threshold and map to AIRAGResult
          ragResults = results
            .filter((r) => r.score >= ragSettings.scoreThreshold)
            .map((r) => ({
              docPath: r.docPath,
              title: r.title,
              content: r.content,
              contentType: r.contentType,
              score: r.score,
            }));

          // If showSourcesInChat is enabled, prepare sources for display
          if (ragSettings.showSourcesInChat && ragResults.length > 0) {
            // Deduplicate by docPath and sort by score (highest first)
            sources = deduplicateByDocPath(ragResults)
              .sort((a, b) => b.score - a.score)
              .map((r) => ({
                docPath: r.docPath,
                title: r.title,
                contentType: r.contentType,
                score: r.score,
              }));

            // Show sources immediately while waiting for AI response
            setPendingSources(sources);
          }
        } catch (error) {
          // Silently fail - RAG is optional enhancement
          console.warn('[AI] RAG search failed:', error);
        }
      }

      // Merge RAG results with existing context
      const enrichedContext: AIContext = {
        ...context,
        ragResults: ragResults.length > 0 ? ragResults : undefined,
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
      // Optimistically add user message
      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      });
    },
    onSuccess: ({ response, sources }) => {
      // Clear pending sources and add assistant message with final sources
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
      // Clear pending sources on error
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
// Email Draft Hook (with RAG)
// =============================================================================

export interface EmailDraftOptions {
  /** The incoming email to reply to */
  email: IncomingEmail;
  /** User's instructions for the reply */
  instructions: string;
  /** Selected project ID (RAG only runs if provided) */
  projectId?: string;
  /** Selected workspace ID */
  workspaceId?: string;
  /** Project name for RAG query context */
  projectName?: string;
  /** Workspace name for RAG query context */
  workspaceName?: string;
}

export interface EmailDraftResult {
  /** Generated draft text */
  draft: string;
  /** Sources used for context (if RAG was performed) */
  sources: AIMessageSource[];
}

/**
 * Hook for drafting email replies with optional RAG context.
 * Only performs RAG search when a project is selected.
 *
 * Usage:
 * ```tsx
 * const emailDraft = useEmailDraft();
 *
 * const result = await emailDraft.mutateAsync({
 *   email,
 *   instructions: 'be brief',
 *   projectId: 'proj-123',
 *   projectName: 'Client Project',
 * });
 * ```
 */
export function useEmailDraft() {
  const service = useAIService();
  const { search: ragSearch, isAvailable: ragAvailable } = useRAGSearch();

  return useMutation({
    mutationFn: async (options: EmailDraftOptions): Promise<EmailDraftResult> => {
      let sources: AIMessageSource[] = [];
      let ragResults: AIRAGResult[] = [];

      // Only perform RAG if project is selected and RAG is available
      if (options.projectId && ragAvailable) {
        try {
          // Build email-specific prequery
          const queryContext: QueryContext = {
            projectId: options.projectId,
            projectName: options.projectName,
            workspaceId: options.workspaceId,
            workspaceName: options.workspaceName,
          };

          const prequery = buildEmailPrequery({
            subject: options.email.subject,
            body: options.email.body,
            fromName: options.email.from.name,
            instructions: options.instructions,
            queryContext,
          });

          // Perform RAG search
          const result = await ragSearch({ query: prequery, queryContext });
          sources = result.sources;
          ragResults = result.ragResults;
        } catch (error) {
          // Silently fail - RAG is optional enhancement
          console.warn('[useEmailDraft] RAG search failed:', error);
        }
      }

      // Call draftEmail with RAG context (if any)
      const response = await service.draftEmail(
        {
          from: formatEmailAddress(options.email.from),
          subject: options.email.subject,
          body: options.email.body,
        },
        options.instructions || 'Write a professional reply.',
        { context: ragResults.length > 0 ? { ragResults } : undefined }
      );

      return {
        draft: response.message,
        sources,
      };
    },
  });
}
