/**
 * The one TanStack QueryClient, as a module singleton.
 *
 * Exported (not created inside a component) so background, non-React code — the maintenance
 * engine's post-write glue in `lib/maintenance.ts`, the watcher bridge — can invalidate queries
 * without prop-drilling a client. `providers.tsx` hands this same instance to the provider.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

/** Query keys owned outside a single hook (so background code can invalidate them). */
export const smartIndexKeys = {
  all: ["smart-index"] as const,
};

export const aiMaintenanceKeys = {
  /** `{providerConfigured, running}` from the host that owns the data (getAIMaintenanceInfo). */
  info: ["ai-maintenance-info"] as const,
};
