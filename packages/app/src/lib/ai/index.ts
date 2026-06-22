// Types
export * from './types';

// Utils
export { parseDocPath } from './utils';

// Provider layer
export { createProvider, type ProviderConfig } from './provider';
export { getProviderDefinition, PROVIDER_REGISTRY } from './provider-registry';
export { getSecret, setSecret, deleteSecret, hasSecret, BrowserModeError, type SecretKeyRef } from './secrets';

// Prompts
export {
  buildAssistantSystemPrompt,
  buildAssistantPromptBreakdown,
  buildAssistantTurnUserMessage,
  buildDraftEmailUserMessage,
  combineInstructions,
  BASE_CONTEXT,
  USER_FACING_PROMPTS,
} from './prompts';

// Service layer (high-level API)
export { AIService, createAIService, type AIServiceConfig } from './service';
