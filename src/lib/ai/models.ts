import type { AIProviderType } from './types';

export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export const PROVIDER_MODELS: Record<AIProviderType, ModelOption[]> = {
  'claude-code': [
    { id: 'sonnet', label: 'Sonnet', description: 'Fast, great for most tasks' },
    { id: 'opus', label: 'Opus', description: 'Most capable, slower' },
    { id: 'haiku', label: 'Haiku', description: 'Fastest, lighter tasks' },
  ],
  'anthropic-api': [
    { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5', description: 'Fast, great for most tasks' },
    { id: 'claude-opus-4-5', label: 'Opus 4.5', description: 'Most capable, slower' },
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5', description: 'Fastest, lighter tasks' },
  ],
};

export const DEFAULT_MODELS: Record<AIProviderType, string> = {
  'claude-code': 'sonnet',
  'anthropic-api': 'claude-sonnet-4-5',
};
