import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EmbeddingSettings } from "@/lib/rag/types";

export type ContextStrategy = 'index' | 'rag' | 'none';
export type EmbeddingProvider = 'auto' | 'ollama' | 'openai' | 'voyage';

interface ContextSettings {
  // Strategy
  contextStrategy: ContextStrategy;

  // Shared
  showSourcesInChat: boolean;

  // Index-specific
  maxFilesPerQuery: number;

  // RAG-specific
  embeddingProvider: EmbeddingProvider;
  ollamaUrl: string;
  ollamaModel: string;
  openaiApiKey: string;
  voyageApiKey: string;
  retrievalCount: number;
  scoreThreshold: number;
  autoIndexOnSave: boolean;
}

interface ContextState extends ContextSettings {
  // Actions
  setContextStrategy: (strategy: ContextStrategy) => void;
  setMaxFilesPerQuery: (count: number) => void;
  setEmbeddingProvider: (provider: EmbeddingProvider) => void;
  setOllamaUrl: (url: string) => void;
  setOllamaModel: (model: string) => void;
  setOpenaiApiKey: (key: string) => void;
  setVoyageApiKey: (key: string) => void;
  setRetrievalCount: (count: number) => void;
  setScoreThreshold: (threshold: number) => void;
  setAutoIndexOnSave: (enabled: boolean) => void;
  setShowSourcesInChat: (enabled: boolean) => void;
  reset: () => void;

  // Helpers
  getEmbeddingSettings: () => EmbeddingSettings;
  isConfigured: () => boolean;
  getConfigWarning: () => string | null;
}

const defaultSettings: ContextSettings = {
  contextStrategy: 'index',
  maxFilesPerQuery: 8,
  embeddingProvider: 'auto',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'nomic-embed-text',
  openaiApiKey: '',
  voyageApiKey: '',
  retrievalCount: 5,
  scoreThreshold: 0.3,
  autoIndexOnSave: true,
  showSourcesInChat: true,
};

export const useContextStore = create<ContextState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      setContextStrategy: (strategy) => set({ contextStrategy: strategy }),
      setMaxFilesPerQuery: (count) => set({ maxFilesPerQuery: count }),
      setEmbeddingProvider: (provider) => set({ embeddingProvider: provider }),
      setOllamaUrl: (url) => set({ ollamaUrl: url }),
      setOllamaModel: (model) => set({ ollamaModel: model }),
      setOpenaiApiKey: (key) => set({ openaiApiKey: key }),
      setVoyageApiKey: (key) => set({ voyageApiKey: key }),
      setRetrievalCount: (count) => set({ retrievalCount: count }),
      setScoreThreshold: (threshold) => set({ scoreThreshold: threshold }),
      setAutoIndexOnSave: (enabled) => set({ autoIndexOnSave: enabled }),
      setShowSourcesInChat: (enabled) => set({ showSourcesInChat: enabled }),
      reset: () => set(defaultSettings),

      getEmbeddingSettings: () => {
        const state = get();
        return {
          provider: state.embeddingProvider,
          ollamaUrl: state.ollamaUrl,
          ollamaModel: state.ollamaModel,
          openaiApiKey: state.openaiApiKey || undefined,
          voyageApiKey: state.voyageApiKey || undefined,
        };
      },

      isConfigured: () => {
        const state = get();
        switch (state.embeddingProvider) {
          case "ollama":
            return !!state.ollamaUrl?.trim();
          case "openai":
            return !!state.openaiApiKey?.trim();
          case "voyage":
            return !!state.voyageApiKey?.trim();
          case "auto":
            return true;
          default:
            return false;
        }
      },

      getConfigWarning: () => {
        const state = get();
        switch (state.embeddingProvider) {
          case "openai":
            if (!state.openaiApiKey?.trim()) {
              return "OpenAI API key not configured";
            }
            break;
          case "voyage":
            if (!state.voyageApiKey?.trim()) {
              return "Voyage API key not configured";
            }
            break;
          case "auto":
            if (!state.openaiApiKey?.trim() && !state.voyageApiKey?.trim()) {
              return "No cloud API keys configured (will only work if Ollama is running)";
            }
            break;
        }
        return null;
      },
    }),
    {
      name: "desk-rag-settings", // Keep same key for backward compatibility
      partialize: (state) => ({
        contextStrategy: state.contextStrategy,
        maxFilesPerQuery: state.maxFilesPerQuery,
        embeddingProvider: state.embeddingProvider,
        ollamaUrl: state.ollamaUrl,
        ollamaModel: state.ollamaModel,
        openaiApiKey: state.openaiApiKey,
        voyageApiKey: state.voyageApiKey,
        retrievalCount: state.retrievalCount,
        scoreThreshold: state.scoreThreshold,
        autoIndexOnSave: state.autoIndexOnSave,
        showSourcesInChat: state.showSourcesInChat,
      }),
    }
  )
);
