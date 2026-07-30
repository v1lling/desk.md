// Types
export * from "./types";

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

// Prompts (Smart Index summarization)
export { BASE_CONTEXT, SYSTEM_PROMPTS } from "./prompts";

// Service layer (high-level API)
export { AIService, createAIService, type AIServiceConfig, type AIServiceResponse } from "./service";
