/**
 * The one source of truth for "is AI configured, and is the engine running" — read from the
 * host that owns the data via `getAIMaintenanceInfo`. Truthful in every mode: locally the key
 * resolver reads this machine's Keychain; in hosted mode the service asks the server about its
 * env keys. This replaces the old DEVICE mirror (`stores/ai.providerConfigured` +
 * `use-secret-hydration`) — there is nothing to keep in sync, the query IS the answer.
 *
 * Invalidate `aiMaintenanceKeys.info` after saving a key so the answer refreshes.
 */
import { useQuery } from "@tanstack/react-query";
import { getDeskService, type AIProviderType } from "@desk/core";
import { aiMaintenanceKeys } from "@/lib/query-client";

export function useAIMaintenanceInfo() {
  return useQuery({
    queryKey: aiMaintenanceKeys.info,
    queryFn: () => getDeskService().getAIMaintenanceInfo(),
    staleTime: 60_000,
  });
}

/** Whether the host that owns the data can resolve a key for `providerType`. */
export function useProviderConfigured(providerType: AIProviderType): boolean {
  const { data } = useAIMaintenanceInfo();
  return !!data?.providerConfigured[providerType];
}
