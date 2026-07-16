import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { AIProviderType } from "./types";
import type { AIKeyRef } from "./key-resolver";

export interface ProviderModelOption {
  id: string;
  label: string;
  description: string;
}

export interface ProviderDefinition {
  providerId: AIProviderType;
  label: string;
  keyRef: AIKeyRef;
  defaultModel: string;
  models: ProviderModelOption[];
  /** The one place a provider SDK model is constructed (used by the transport). */
  createModel: (apiKey: string, modelId?: string) => LanguageModel;
}

/**
 * The single source of truth for providers: label, key seam ref, model catalog, default model,
 * and the SDK model factory. The transport (`transport.ts`), the key resolver, and the Settings
 * model picker (`PROVIDER_MODELS`/`DEFAULT_MODELS`, derived below) all read from here.
 */
export const PROVIDER_REGISTRY: Record<AIProviderType, ProviderDefinition> = {
  anthropic: {
    providerId: "anthropic",
    label: "Anthropic",
    keyRef: "ai.anthropic",
    defaultModel: "claude-sonnet-4-5",
    models: [
      { id: "claude-sonnet-4-5", label: "Sonnet 4.5", description: "Fast, great for most tasks" },
      { id: "claude-opus-4-5", label: "Opus 4.5", description: "Most capable, slower" },
      { id: "claude-haiku-4-5", label: "Haiku 4.5", description: "Fastest, lighter tasks" },
    ],
    createModel: (apiKey, modelId) => createAnthropic({ apiKey })(modelId || "claude-sonnet-4-5"),
  },
  openai: {
    providerId: "openai",
    label: "OpenAI",
    keyRef: "ai.openai",
    defaultModel: "gpt-5-mini",
    models: [
      { id: "gpt-5-mini", label: "GPT-5 Mini", description: "Balanced quality and speed" },
      { id: "gpt-5", label: "GPT-5", description: "High capability general model" },
      { id: "gpt-5-codex", label: "GPT-5 Codex", description: "Code-focused reasoning" },
    ],
    createModel: (apiKey, modelId) => createOpenAI({ apiKey })(modelId || "gpt-5-mini"),
  },
};

export function getProviderDefinition(provider: AIProviderType): ProviderDefinition {
  return PROVIDER_REGISTRY[provider];
}

const providerTypes = Object.keys(PROVIDER_REGISTRY) as AIProviderType[];

/** Model catalog for the Settings picker, derived from the registry (one source of truth). */
export const PROVIDER_MODELS: Record<AIProviderType, ProviderModelOption[]> = Object.fromEntries(
  providerTypes.map((p) => [p, PROVIDER_REGISTRY[p].models]),
) as Record<AIProviderType, ProviderModelOption[]>;

export const DEFAULT_MODELS: Record<AIProviderType, string> = Object.fromEntries(
  providerTypes.map((p) => [p, PROVIDER_REGISTRY[p].defaultModel]),
) as Record<AIProviderType, string>;
