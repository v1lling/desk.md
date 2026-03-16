// Types
export * from './types';

// Utils
export { parseDocPath } from './utils';
export { deduplicateContext } from './context-dedup';

// Provider layer
export { createProvider, type ProviderConfig } from './provider';
export { getProviderDefinition, PROVIDER_REGISTRY } from './provider-registry';
export { getSecret, setSecret, deleteSecret, hasSecret, type SecretKeyRef } from './secrets';

// Prompts
export {
  buildPrompt,
  buildAssistantSystemPrompt,
  buildAssistantPromptBreakdown,
  buildAssistantTurnUserMessage,
  buildDraftEmailUserMessage,
  formatContext,
  combineInstructions,
  BASE_CONTEXT,
  USER_FACING_PROMPTS,
} from './prompts';

// Service layer (high-level API)
export { AIService, createAIService, type AIServiceConfig } from './service';
