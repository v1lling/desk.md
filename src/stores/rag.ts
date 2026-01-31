import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  setAutoIndexOnSave: (enabled: boolean) => void;
  setShowSourcesInChat: (enabled: boolean) => void;
  reset: () => void;
}

const defaultSettings: RAGSettings = {
  embeddingProvider: 'auto',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'nomic-embed-text',
  openaiApiKey: '',
  voyageApiKey: '',
  retrievalCount: 5,
  autoIndexOnSave: true,
  showSourcesInChat: true,
};

export const useRAGStore = create<RAGState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setEmbeddingProvider: (provider) => set({ embeddingProvider: provider }),
      setOllamaUrl: (url) => set({ ollamaUrl: url }),
      setOllamaModel: (model) => set({ ollamaModel: model }),
      setOpenaiApiKey: (key) => set({ openaiApiKey: key }),
      setVoyageApiKey: (key) => set({ voyageApiKey: key }),
      setRetrievalCount: (count) => set({ retrievalCount: count }),
      setAutoIndexOnSave: (enabled) => set({ autoIndexOnSave: enabled }),
      setShowSourcesInChat: (enabled) => set({ showSourcesInChat: enabled }),
      reset: () => set(defaultSettings),
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
        autoIndexOnSave: state.autoIndexOnSave,
        showSourcesInChat: state.showSourcesInChat,
      }),
    }
  )
);
