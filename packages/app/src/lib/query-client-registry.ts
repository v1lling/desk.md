/**
 * Query-client registry — a module-level handle to the app's single TanStack
 * QueryClient, for the rare non-React caller that must invalidate caches outside
 * a component/hook (e.g. the assistant's remote-write refresh).
 *
 * Registered once at boot by `useQueryInvalidator()`; everything React-side keeps
 * using `useQueryClient()` as normal.
 */
import type { QueryClient } from "@tanstack/react-query";

let queryClientRef: QueryClient | null = null;

export function registerQueryClient(client: QueryClient): void {
  queryClientRef = client;
}

export function getRegisteredQueryClient(): QueryClient | null {
  return queryClientRef;
}
