// Types
export * from './types';

// Provider layer
export { createProvider, type ProviderConfig } from './provider';
export { getProviderDefinition, PROVIDER_REGISTRY } from './provider-registry';
export { getSecret, setSecret, deleteSecret, hasSecret, BrowserModeError, type SecretKeyRef } from './secrets';

// Prompts (Smart Index summarization)
export { BASE_CONTEXT, SYSTEM_PROMPTS } from './prompts';

// Service layer (high-level API)
export { AIService, createAIService, type AIServiceConfig } from './service';
