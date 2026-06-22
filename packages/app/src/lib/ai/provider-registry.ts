import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { AIProviderType } from "./types";
import type { SecretKeyRef } from "./secrets";

export interface ProviderCapability {
  chat: boolean;
  tools: boolean;
  streaming: boolean;
}

export interface ProviderModelOption {
  id: string;
  label: string;
  description: string;
}

export interface ProviderDefinition {
  providerId: AIProviderType;
  label: string;
  keyRef: SecretKeyRef;
  capabilities: ProviderCapability;
  defaultModel: string;
  models: ProviderModelOption[];
  createModel: (apiKey: string, modelId?: string) => LanguageModel;
}

export const PROVIDER_REGISTRY: Record<AIProviderType, ProviderDefinition> = {
  anthropic: {
    providerId: "anthropic",
    label: "Anthropic",
    keyRef: "ai.anthropic",
    capabilities: { chat: true, tools: true, streaming: true },
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
    capabilities: { chat: true, tools: true, streaming: true },
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

