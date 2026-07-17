// =============================================================================
// Core Types
// =============================================================================

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// =============================================================================
// Provider Types
// =============================================================================

export type AIProviderType = 'anthropic' | 'openai';

// =============================================================================
// Usage Tracking Types
// =============================================================================

/** AI call purposes tracked in the usage stats. */
export type AIPurpose =
  | 'index'            // Smart Index summarization (batch build + on-save)
  | 'context-refresh'; // Rewrite a project's state file from the records that changed since

export interface AIUsageRecord {
  id: string;
  timestamp: string;
  purpose: AIPurpose;
  provider: AIProviderType;
  usage: AIUsage;
}
