/**
 * TanStack Query keys for the file-tree cache scope.
 *
 * The React hooks that used to live here were never consumed — list views read through the
 * domain stores, and the watcher connection lives in `use-query-invalidator.ts`, which uses
 * this key factory to invalidate the file-tree scope on watcher events.
 */
export const fileTreeKeys = {
  all: ["file-tree"] as const,
};
