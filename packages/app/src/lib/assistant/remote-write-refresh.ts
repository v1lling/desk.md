/**
 * Remote-write refresh — keeps the client's view in sync after the assistant
 * writes in hosted mode.
 *
 * In local mode the OS file watcher observes the assistant's writes and drives
 * query invalidation. In hosted mode the write runs on the *server*, the local
 * watcher is off, and it wouldn't see the server's disk anyway — so nothing
 * refreshes. After a successful remote write tool, we invalidate the client's
 * TanStack caches off the returned file path so list / board / tree views catch
 * up. (A doc simultaneously open in an editor while the assistant edits it is not
 * live-synced in hosted mode; the change persists server-side and shows on reopen.)
 */
import { getRegisteredQueryClient } from "@/lib/query-client-registry";
import { invalidateQueriesForPaths } from "@/hooks/use-query-invalidator";

export function invalidateAfterRemoteWrite(path: string): void {
  const queryClient = getRegisteredQueryClient();
  if (!queryClient) return;
  invalidateQueriesForPaths([path], queryClient);
}
