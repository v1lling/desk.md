import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIProviderType, AIPurpose, AIUsage, AIUsageRecord } from "@/lib/ai";

// =============================================================================
// AI Settings Store (persisted)
// =============================================================================

interface AISettingsState {
  providerType: AIProviderType;
  providerConfigured: Record<AIProviderType, boolean>;
  customInstructions: string;
  perTypeInstructions: Record<string, string>;
  /** Model ID per provider (empty = use provider default model) */
  modelByProvider: Record<string, string>;
  setProviderType: (type: AIProviderType) => void;
  setProviderConfigured: (provider: AIProviderType, configured: boolean) => void;
  setCustomInstructions: (instructions: string) => void;
  setPerTypeInstructions: (purpose: string, instructions: string) => void;
  setModelForProvider: (provider: AIProviderType, model: string) => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      providerType: "openai",
      providerConfigured: {
        openai: false,
        anthropic: false,
      },
      customInstructions: "",
      perTypeInstructions: {},
      modelByProvider: {},
      setProviderType: (type) => set({ providerType: type }),
      setProviderConfigured: (provider, configured) =>
        set((state) => ({
          providerConfigured: { ...state.providerConfigured, [provider]: configured },
        })),
      setCustomInstructions: (instructions) => set({ customInstructions: instructions }),
      setPerTypeInstructions: (purpose, instructions) =>
        set((state) => ({
          perTypeInstructions: { ...state.perTypeInstructions, [purpose]: instructions },
        })),
      setModelForProvider: (provider, model) =>
        set((state) => ({
          modelByProvider: { ...state.modelByProvider, [provider]: model },
        })),
    }),
    {
      name: "desk-ai-settings-v2",
    }
  )
);

// =============================================================================
// AI Usage Store (persisted)
// =============================================================================

interface AIUsageState {
  records: AIUsageRecord[];
  addRecord: (record: Omit<AIUsageRecord, "id" | "timestamp">) => void;
  clearRecords: () => void;
  getStats: () => {
    totalTokens: number;
    totalRequests: number;
    byPurpose: Record<string, { tokens: number; requests: number }>;
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
        const byPurpose: Record<string, { tokens: number; requests: number }> = {};

        let totalTokens = 0;
        for (const record of records) {
          totalTokens += record.usage.totalTokens;

          if (!byProvider[record.provider]) {
            byProvider[record.provider] = { tokens: 0, requests: 0 };
          }
          byProvider[record.provider].tokens += record.usage.totalTokens;
          byProvider[record.provider].requests += 1;

          if (!byPurpose[record.purpose]) {
            byPurpose[record.purpose] = { tokens: 0, requests: 0 };
          }
          byPurpose[record.purpose].tokens += record.usage.totalTokens;
          byPurpose[record.purpose].requests += 1;
        }

        return {
          totalTokens,
          totalRequests: records.length,
          byPurpose,
          byProvider,
        };
      },
    }),
    {
      name: "desk-ai-usage",
    }
  )
);

export type { AIPurpose, AIUsage };
