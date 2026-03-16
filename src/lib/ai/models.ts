import type { AIProviderType } from './types';

export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export const PROVIDER_MODELS: Record<AIProviderType, ModelOption[]> = {
  'anthropic': [
    { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5', description: 'Fast, great for most tasks' },
    { id: 'claude-opus-4-5', label: 'Opus 4.5', description: 'Most capable, slower' },
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5', description: 'Fastest, lighter tasks' },
  ],
  'openai': [
    { id: 'gpt-5-mini', label: 'GPT-5 Mini', description: 'Balanced quality and speed' },
    { id: 'gpt-5', label: 'GPT-5', description: 'High capability general model' },
    { id: 'gpt-5-codex', label: 'GPT-5 Codex', description: 'Code-focused reasoning' },
  ],
};

export const DEFAULT_MODELS: Record<AIProviderType, string> = {
  'openai': 'gpt-5-mini',
  'anthropic': 'claude-sonnet-4-5',
};
