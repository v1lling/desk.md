import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIProviderType, AIPurpose, AIUsage, AIUsageRecord } from "@/lib/ai";
import { createFileStorage } from "./file-storage";

// =============================================================================
// AI Settings Store (persisted)
// =============================================================================

interface AISettingsState {
  providerType: AIProviderType;
  providerConfigured: Record<AIProviderType, boolean>;
  /** Model ID per provider (empty = use provider default model) */
  modelByProvider: Record<string, string>;
  /** True once the user has acknowledged the AI privacy disclosure. */
  aiConsentGiven: boolean;
  setProviderType: (type: AIProviderType) => void;
  setProviderConfigured: (provider: AIProviderType, configured: boolean) => void;
  setModelForProvider: (provider: AIProviderType, model: string) => void;
  setAIConsentGiven: (given: boolean) => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      providerType: "openai",
      providerConfigured: {
        openai: false,
        anthropic: false,
      },
      modelByProvider: {},
      aiConsentGiven: false,
      setProviderType: (type) => set({ providerType: type }),
      setProviderConfigured: (provider, configured) =>
        set((state) => ({
          providerConfigured: { ...state.providerConfigured, [provider]: configured },
        })),
      setModelForProvider: (provider, model) =>
        set((state) => ({
          modelByProvider: { ...state.modelByProvider, [provider]: model },
        })),
      setAIConsentGiven: (given) => set({ aiConsentGiven: given }),
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
        set((state) => {
          // Prune records older than 90 days
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 90);
          const cutoffStr = cutoff.toISOString();
          const pruned = state.records.filter((r) => r.timestamp > cutoffStr);
          return {
            records: [
              ...pruned,
              {
                ...record,
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
              },
            ],
          };
        }),
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
      storage: createFileStorage<AIUsageState>("usage", "ai-usage.json"),
    }
  )
);

export type { AIPurpose, AIUsage };
