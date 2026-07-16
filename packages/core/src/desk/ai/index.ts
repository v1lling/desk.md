// Types
export * from "./types";

// Key resolution (injectable host seam — Keychain on the app, env on the server)
export { setAIKeyResolver, getAIKeyResolver, type AIKeyRef, type AIKeyResolver } from "./key-resolver";

// Provider registry (single source: catalog, key seam ref, model factory) + derived catalog
export {
  getProviderDefinition,
  PROVIDER_REGISTRY,
  PROVIDER_MODELS,
  DEFAULT_MODELS,
  type ProviderDefinition,
  type ProviderModelOption,
} from "./provider-registry";

// Typed provider errors (classified once, at the transport)
export {
  AIProviderError,
  isAIProviderError,
  classifyAIError,
  type AIErrorCode,
} from "./errors";

// Prompts (Smart Index summarization + project-state refresh)
export { BASE_CONTEXT, SYSTEM_PROMPTS } from "./prompts";

// Service layer (high-level API)
export { AIService, createAIService, type AIServiceConfig, type AIServiceResponse } from "./service";
