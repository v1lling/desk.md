// =============================================================================
// Core Types
// =============================================================================

export interface AIMessageSource {
  docPath: string;
  title: string;
  contentType: 'doc' | 'task' | 'meeting';
  /** Relevance score from context retrieval (0-1, higher = more relevant) */
  score?: number;
  /** Workspace the source was retrieved from */
  workspaceId?: string;
  /** Display name of the workspace */
  workspaceName?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** Sources used for this response (only for assistant messages) */
  sources?: AIMessageSource[];
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// =============================================================================
// Context Types
// =============================================================================

export interface AIDoc {
  id: string;
  title: string;
  content: string;
}

export interface AITask {
  id: string;
  title: string;
  status: string;
  content?: string;
}

export interface AIEmail {
  id: string;
  subject: string;
  from: string;
  body: string;
}

export interface AIContextResult {
  docPath: string;
  title: string;
  content: string;
  contentType: 'doc' | 'task' | 'meeting';
  score: number;
}

export interface AIContext {
  docs?: AIDoc[];
  tasks?: AITask[];
  emails?: AIEmail[];
  custom?: Record<string, string>;
  /** Auto-retrieved context results */
  contextResults?: AIContextResult[];
  /** Titles of files already sent in earlier conversation turns (for AI awareness) */
  previousContextTitles?: string[];
}

// =============================================================================
// Request/Response Types
// =============================================================================

export interface AIRequest {
  message: string;
  systemPrompt?: string;
  context?: AIContext;
  history?: AIMessage[];
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
  // Future: stream support
  // streamChat?(request: AIRequest): AsyncIterable<string>;
}

export type AIProviderType = 'anthropic' | 'openai';

// =============================================================================
// Service Types - Purpose-based AI interactions
// =============================================================================

/** Available AI purposes - each has its own system prompt and behavior profile */
export type AIPurpose =
  | 'chat'           // General chat with manual context
  | 'draft-email'    // Draft email response
  | 'custom';        // Custom purpose with provided prompt

export interface AIServiceRequest {
  purpose: AIPurpose;
  message: string;
  context?: AIContext;
  history?: AIMessage[];
  /** Custom system prompt (required for 'custom' purpose) */
  customSystemPrompt?: string;
  /** User's standing instructions (always included in prompts) */
  userInstructions?: string;
}

export interface AIServiceResponse {
  message: string;
  usage?: AIUsage;
  /** Parsed structured data if applicable */
  structured?: {
    tasks?: AITask[];
    // Future: emails, summaries, etc.
  };
}

// =============================================================================
// Usage Tracking Types
// =============================================================================

export interface AIUsageRecord {
  id: string;
  timestamp: string;
  purpose: AIPurpose;
  provider: AIProviderType;
  usage: AIUsage;
}

export interface AIUsageStats {
  totalTokens: number;
  totalRequests: number;
  byPurpose: Record<AIPurpose, { tokens: number; requests: number }>;
  byProvider: Record<AIProviderType, { tokens: number; requests: number }>;
}
