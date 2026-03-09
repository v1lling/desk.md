// Types
export * from './types';

// Utils
export { parseDocPath } from './utils';
export { deduplicateContext } from './context-dedup';

// Provider layer
export { createProvider, type ProviderConfig } from './provider';
export { isClaudeCodeAvailable } from './providers/claude-code';

// Prompts
export { buildPrompt, formatContext, combineInstructions, BASE_CONTEXT, USER_FACING_PROMPTS } from './prompts';

// Service layer (high-level API)
export { AIService, createAIService, type AIServiceConfig } from './service';
