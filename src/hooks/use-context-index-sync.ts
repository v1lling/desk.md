/**
 * Context Index Sync Hook
 *
 * Lightweight hook that loads indexes from the store on app launch.
 * Incremental updates (hash refresh on save) happen in the context indexer flow.
 * Full rebuilds (with AI summarization) are triggered manually in Settings.
 */

import { useEffect } from "react";

/**
 * Provider component that initializes context index on app launch.
 * Mounted in providers.tsx.
 */
export function useContextIndexSync() {
  useEffect(() => {
    // Index data is persisted via zustand/persist in context-index store.
    // No additional initialization needed on launch — the store
    // auto-rehydrates from localStorage.
    // Manual "Build Index" in settings is what creates/refreshes the data.
  }, []);
}
