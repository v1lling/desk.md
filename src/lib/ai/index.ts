// Types
export * from './types';

// Utils
export { parseDocPath } from './utils';

// Provider layer
export { createProvider, type ProviderConfig } from './provider';
export { isClaudeCodeAvailable } from './providers/claude-code';

// Prompts
export { buildPrompt, formatContext } from './prompts';

// Service layer (high-level API)
export { AIService, createAIService, type AIServiceConfig } from './service';
