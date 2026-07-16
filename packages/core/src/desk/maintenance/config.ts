/**
 * Maintenance settings — read from the shared USER-scope settings file
 * (`.desk/settings/ai-maintenance.json` via the settings KV), so one set of toggles steers
 * whichever engine runs: the app's in local mode, the server's in hosted mode. The app's
 * Settings UI writes the same file through `createRemoteSettingStorage("ai-maintenance")`.
 *
 * `AI_MAINTENANCE_DEFAULTS` is the ONE definition of the shape's defaults — the app store spreads
 * it too, so the two can't drift. Re-read at every fire (the file is tiny), so a toggle flipped
 * mid-debounce is honored.
 */
import { getSetting } from "../settings";
import { createAIService, type AIService } from "../ai/service";
import { appendAIUsage } from "../ai-usage";
import type { AIProviderType, AIPurpose } from "../ai/types";
import type { SummaryDetail } from "./types";

export interface AIMaintenanceSettings {
  autoSummarizeOnSave: boolean;
  autoRefreshProjectState: boolean;
  summaryDetail: SummaryDetail;
  providerType: AIProviderType;
  /** Model ID per provider (empty = provider default). */
  modelByProvider: Record<string, string>;
}

export const AI_MAINTENANCE_DEFAULTS: AIMaintenanceSettings = {
  autoSummarizeOnSave: true,
  autoRefreshProjectState: true,
  summaryDetail: "brief",
  providerType: "openai",
  modelByProvider: {},
};

export async function getAIMaintenanceSettings(): Promise<AIMaintenanceSettings> {
  try {
    const raw = await getSetting("ai-maintenance");
    if (!raw) return { ...AI_MAINTENANCE_DEFAULTS };
    // Plain JSON now; tolerate a legacy zustand envelope (`{state, version}`) still on disk.
    const parsed = JSON.parse(raw) as { state?: Partial<AIMaintenanceSettings> } | Partial<AIMaintenanceSettings> | null;
    const state = (parsed && typeof parsed === "object" && "state" in parsed ? parsed.state : parsed) ?? {};
    return { ...AI_MAINTENANCE_DEFAULTS, ...state };
  } catch {
    return { ...AI_MAINTENANCE_DEFAULTS };
  }
}

/**
 * The one place the maintenance engine builds an AI service from settings: provider + model from
 * the shared config, usage logged under `purpose`. Used by the state refresher, the incremental
 * indexer, and the full rebuild — identical construction that previously lived in all three.
 */
export function createMaintenanceService(settings: AIMaintenanceSettings, purpose: AIPurpose): AIService {
  return createAIService({
    providerType: settings.providerType,
    model: settings.modelByProvider[settings.providerType] || undefined,
    onUsage: (usage) => void appendAIUsage({ purpose, provider: settings.providerType, usage }),
  });
}
