/**
 * File Tree React Hooks
 *
 * React hooks for accessing the file tree service.
 * Integrates with TanStack Query for caching and state management.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useRef } from "react";
import type { TreeNode, TraversalOptions, CacheStats, ContentParser } from "./types";
import { getFileTreeService } from "./service";
import { connectToWatcher, disconnectFromWatcher } from "./watcher-integration";

/**
 * Query keys for file tree queries
 */
export const fileTreeKeys = {
  all: ["file-tree"] as const,
  tree: (path: string) => [...fileTreeKeys.all, "tree", path] as const,
  children: (path: string) => [...fileTreeKeys.all, "children", path] as const,
  node: (path: string) => [...fileTreeKeys.all, "node", path] as const,
  content: (path: string) => [...fileTreeKeys.all, "content", path] as const,
};

/**
 * Hook to initialize the file tree service and connect to watcher
 * Call this once at app startup (e.g., in providers)
 */
export function useFileTreeInit() {
  const isInitialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in strict mode
    if (isInitialized.current) return;
    isInitialized.current = true;

    const service = getFileTreeService();
    service.initialize()
      .then(() => {
        // Connect to watcher after service is initialized
        connectToWatcher();
      })
      .catch((err) => {
        console.error("[useFileTreeInit] Failed to initialize:", err);
      });

    return () => {
      disconnectFromWatcher();
      isInitialized.current = false;
    };
  }, []);
}

/**
 * Hook to get the full tree from a path
 */
export function useFileTree(relativePath: string = "") {
  return useQuery({
    queryKey: fileTreeKeys.tree(relativePath),
    queryFn: async () => {
      const service = getFileTreeService();
      return service.getTree(relativePath);
    },
    staleTime: 5000, // 5 seconds
  });
}

/**
 * Hook to get children of a directory
 */
export function useFileTreeChildren(
  relativePath: string,
  options?: TraversalOptions
) {
  return useQuery({
    queryKey: [...fileTreeKeys.children(relativePath), options],
    queryFn: async () => {
      const service = getFileTreeService();
      return service.getChildren(relativePath, options);
    },
    staleTime: 5000,
  });
}

/**
 * Hook to get a single node
 */
export function useFileTreeNode(relativePath: string) {
  return useQuery({
    queryKey: fileTreeKeys.node(relativePath),
    queryFn: async () => {
      const service = getFileTreeService();
      return service.getNode(relativePath);
    },
    staleTime: 5000,
    enabled: !!relativePath,
  });
}

/**
 * Hook to get parsed file content
 */
export function useFileContent<T>(
  relativePath: string,
  parser?: ContentParser<T>
) {
  return useQuery({
    queryKey: fileTreeKeys.content(relativePath),
    queryFn: async () => {
      const service = getFileTreeService();
      return service.getContent<T>(relativePath, parser);
    },
    staleTime: 10000, // 10 seconds - content is more stable
    enabled: !!relativePath,
  });
}

/**
 * Hook to get raw file content
 */
export function useRawFileContent(relativePath: string) {
  return useFileContent<string>(relativePath, (raw) => raw);
}

/**
 * Hook to get cache statistics
 */
export function useFileTreeCacheStats(): CacheStats {
  const service = getFileTreeService();
  return service.getCacheStats();
}

/**
 * Hook to invalidate file tree queries
 * Returns a function to trigger invalidation
 */
export function useInvalidateFileTree() {
  const queryClient = useQueryClient();

  return useCallback(
    (relativePath?: string) => {
      if (relativePath) {
        // Invalidate specific path and its children
        queryClient.invalidateQueries({
          queryKey: fileTreeKeys.tree(relativePath),
        });
        queryClient.invalidateQueries({
          queryKey: fileTreeKeys.children(relativePath),
        });
        queryClient.invalidateQueries({
          queryKey: fileTreeKeys.node(relativePath),
        });
        queryClient.invalidateQueries({
          queryKey: fileTreeKeys.content(relativePath),
        });
      } else {
        // Invalidate all file tree queries
        queryClient.invalidateQueries({
          queryKey: fileTreeKeys.all,
        });
      }

      // Also clear service cache
      const service = getFileTreeService();
      if (relativePath) {
        service.invalidateCache(relativePath);
      } else {
        service.clearCache();
      }
    },
    [queryClient]
  );
}

/**
 * Hook to subscribe to file tree changes
 * Automatically invalidates queries when changes occur
 */
export function useFileTreeSubscription(relativePath: string = "") {
  const queryClient = useQueryClient();

  useEffect(() => {
    const service = getFileTreeService();

    const unsubscribe = service.subscribe(relativePath, (event) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: fileTreeKeys.all,
      });
    });

    return unsubscribe;
  }, [relativePath, queryClient]);
}
