// =============================================================================
// Core Types
// =============================================================================

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// =============================================================================
// Request/Response Types (provider transport layer)
// =============================================================================

export interface AIRequest {
  message: string;
  systemPrompt?: string;
}

export interface AIResponse {
  message: string;
  usage?: AIUsage;
}

// =============================================================================
// Provider Types
// =============================================================================

export interface AIProvider {
  id: string;
  name: string;
  chat(request: AIRequest): Promise<AIResponse>;
}

export type AIProviderType = 'anthropic' | 'openai';

// =============================================================================
// Usage Tracking Types
// =============================================================================

/** AI call purposes tracked in the usage stats. */
export type AIPurpose =
  | 'index'   // Smart Index summarization (batch build + on-save)
  | 'custom'; // Custom prompt via AIService.custom()

export interface AIUsageRecord {
  id: string;
  timestamp: string;
  purpose: AIPurpose;
  provider: AIProviderType;
  usage: AIUsage;
}
