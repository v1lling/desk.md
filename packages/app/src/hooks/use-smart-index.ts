/**
 * Read access to the Smart Index (`.desk/index/indexes.json`).
 *
 * Core is the sole writer (the maintenance engine + local rebuild, via `writeWorkspaceIndex`);
 * the UI only reads, through this query. Works in every mode because it goes through
 * `getDeskService().getIndexCache()`: local disk in Tauri, the server's file over RPC in hosted
 * mode. Background writes invalidate `smartIndexKeys.all` to trigger a re-read.
 */
import { useQuery } from "@tanstack/react-query";
import { getDeskService, type WorkspaceIndex } from "@desk/core";
import { smartIndexKeys } from "@/lib/query-client";

export type WorkspaceIndexMap = Record<string, WorkspaceIndex>;

/** Parse the index file's plain `{ indexes }` shape (tolerating a legacy zustand envelope). */
function parseIndexes(raw: string | null): WorkspaceIndexMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as {
      indexes?: WorkspaceIndexMap;
      state?: { indexes?: WorkspaceIndexMap };
    };
    return parsed.indexes ?? parsed.state?.indexes ?? {};
  } catch {
    return {};
  }
}

export function useSmartIndex() {
  return useQuery({
    queryKey: smartIndexKeys.all,
    queryFn: async () => parseIndexes(await getDeskService().getIndexCache()),
    staleTime: 30_000,
  });
}
