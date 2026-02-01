import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EmbeddingSettings } from "@/lib/rag/types";

export type EmbeddingProvider = 'auto' | 'ollama' | 'openai' | 'voyage';

interface RAGSettings {
  // Provider (user's choice)
  embeddingProvider: EmbeddingProvider;

  // Ollama (local)
  ollamaUrl: string;
  ollamaModel: string;

  // OpenAI (cloud)
  openaiApiKey: string;

  // Voyage (cloud)
  voyageApiKey: string;

  // Retrieval
  retrievalCount: number;
  /** Minimum similarity score (0-1) to include in results. Default 0.3 */
  scoreThreshold: number;

  // Behavior
  autoIndexOnSave: boolean;
  showSourcesInChat: boolean;
}

interface RAGState extends RAGSettings {
  // Actions
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
  /**
   * Get current settings as EmbeddingSettings object
   */
  getEmbeddingSettings: () => EmbeddingSettings;
  /**
   * Check if the current provider has valid configuration.
   * For openai/voyage, checks if API key is set.
   * For ollama, checks if URL is set.
   * For auto, always returns true (will try available providers).
   */
  isConfigured: () => boolean;
  /**
   * Get description of what's missing for the current provider.
   * Returns null if fully configured.
   */
  getConfigWarning: () => string | null;
}

const defaultSettings: RAGSettings = {
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

export const useRAGStore = create<RAGState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

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
            // Auto mode can always try (Ollama might be available)
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
            // Auto mode: warn if no cloud fallback configured
            if (!state.openaiApiKey?.trim() && !state.voyageApiKey?.trim()) {
              return "No cloud API keys configured (will only work if Ollama is running)";
            }
            break;
        }
        return null;
      },
    }),
    {
      name: "desk-rag-settings",
      partialize: (state) => ({
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
