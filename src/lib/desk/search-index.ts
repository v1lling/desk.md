/**
 * Search Index Service
 *
 * In-memory search index for fast lookups across all items.
 * Built on app startup, updated via file watcher events.
 */

import Fuse, { type IFuseOptions } from "fuse.js";
import type { Task, Doc, Meeting, Project } from "@/types";

// Unified search item type
export type SearchItemType = "task" | "doc" | "meeting" | "project";

export interface SearchItem {
  id: string;
  type: SearchItemType;
  title: string;
  content: string; // Preview/excerpt for search
  workspaceId: string;
  workspaceName?: string;
  projectId: string;
  projectName?: string;
  // Metadata for filtering/display
  status?: string;
  priority?: string;
  due?: string;
  created: string;
  // Full path for navigation
  filePath?: string;
}

export interface SearchResult {
  item: SearchItem;
  score: number; // 0 = perfect match, 1 = no match
  matches?: Array<{
    key: string;
    indices: Array<[number, number]>;
  }>;
}

// Fuse.js configuration for fuzzy search
const FUSE_OPTIONS: IFuseOptions<SearchItem> = {
  keys: [
    { name: "title", weight: 0.6 },
    { name: "content", weight: 0.3 },
    { name: "projectName", weight: 0.1 },
  ],
  threshold: 0.4, // 0 = exact, 1 = match anything
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  ignoreLocation: true, // Search entire string, not just beginning
};

// Singleton state
let items: SearchItem[] = [];
let fuse: Fuse<SearchItem> | null = null;
let isInitialized = false;

/**
 * Initialize or rebuild the entire index
 */
export function rebuildIndex(newItems: SearchItem[]): void {
  items = newItems;
  fuse = new Fuse(items, FUSE_OPTIONS);
  isInitialized = true;
  console.log(`[search-index] Index built with ${items.length} items`);
}

/**
 * Add or update an item in the index
 */
export function upsertItem(item: SearchItem): void {
  const existingIndex = items.findIndex(
    (i) => i.id === item.id && i.type === item.type
  );

  if (existingIndex >= 0) {
    items[existingIndex] = item;
  } else {
    items.push(item);
  }

  // Rebuild Fuse index (it doesn't support incremental updates well)
  fuse = new Fuse(items, FUSE_OPTIONS);
}

/**
 * Remove an item from the index
 */
export function removeItem(id: string, type: SearchItemType): void {
  const index = items.findIndex((i) => i.id === id && i.type === type);
  if (index >= 0) {
    items.splice(index, 1);
    fuse = new Fuse(items, FUSE_OPTIONS);
  }
}

/**
 * Remove all items for a workspace (e.g., when workspace is deleted)
 */
export function removeWorkspaceItems(workspaceId: string): void {
  items = items.filter((i) => i.workspaceId !== workspaceId);
  fuse = new Fuse(items, FUSE_OPTIONS);
}

/**
 * Search the index with fuzzy matching
 */
export function search(
  query: string,
  options?: {
    types?: SearchItemType[];
    workspaceId?: string;
    limit?: number;
  }
): SearchResult[] {
  if (!fuse || !isInitialized) {
    console.warn("[search-index] Index not initialized");
    return [];
  }

  if (!query.trim()) {
    // Return recent items if no query
    return getRecentItems(options?.limit ?? 10, options?.types, options?.workspaceId);
  }

  let results = fuse.search(query);

  // Apply filters
  if (options?.types && options.types.length > 0) {
    results = results.filter((r) => options.types!.includes(r.item.type));
  }

  if (options?.workspaceId) {
    results = results.filter((r) => r.item.workspaceId === options.workspaceId);
  }

  // Apply limit
  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results.map((r) => ({
    item: r.item,
    score: r.score ?? 0,
    matches: r.matches?.map((m) => ({
      key: m.key ?? "",
      indices: m.indices as Array<[number, number]>,
    })),
  }));
}

/**
 * Get recent items (by created date)
 */
export function getRecentItems(
  limit: number = 10,
  types?: SearchItemType[],
  workspaceId?: string
): SearchResult[] {
  let filtered = items;

  if (types && types.length > 0) {
    filtered = filtered.filter((i) => types.includes(i.type));
  }

  if (workspaceId) {
    filtered = filtered.filter((i) => i.workspaceId === workspaceId);
  }

  // Sort by created date descending
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
  );

  return sorted.slice(0, limit).map((item) => ({
    item,
    score: 0,
  }));
}

/**
 * Get index statistics
 */
export function getIndexStats(): {
  totalItems: number;
  byType: Record<SearchItemType, number>;
  isInitialized: boolean;
} {
  const byType: Record<SearchItemType, number> = {
    task: 0,
    doc: 0,
    meeting: 0,
    project: 0,
  };

  for (const item of items) {
    byType[item.type]++;
  }

  return {
    totalItems: items.length,
    byType,
    isInitialized,
  };
}

/**
 * Check if index is ready
 */
export function isIndexReady(): boolean {
  return isInitialized;
}

/**
 * Find a specific item by type and id.
 * Used for resolving internal note links (desk:// URIs).
 */
export function findByTypeAndId(
  type: SearchItemType,
  id: string
): SearchItem | null {
  if (!isInitialized) return null;
  return items.find((i) => i.type === type && i.id === id) ?? null;
}

/**
 * Clear the index
 */
export function clearIndex(): void {
  items = [];
  fuse = null;
  isInitialized = false;
}

// Helper functions to convert domain objects to SearchItems

export function taskToSearchItem(
  task: Task,
  workspaceName?: string,
  projectName?: string
): SearchItem {
  return {
    id: task.id,
    type: "task",
    title: task.title,
    content: task.content?.slice(0, 200) ?? "",
    workspaceId: task.workspaceId,
    workspaceName,
    projectId: task.projectId,
    projectName,
    status: task.status,
    priority: task.priority,
    due: task.due,
    created: task.created,
    filePath: task.filePath,
  };
}

export function docToSearchItem(
  doc: Doc,
  workspaceName?: string,
  projectName?: string
): SearchItem {
  return {
    id: doc.id,
    type: "doc",
    title: doc.title,
    content: doc.content?.slice(0, 200) ?? "",
    workspaceId: doc.workspaceId,
    workspaceName,
    projectId: doc.projectId,
    projectName,
    created: doc.created,
    filePath: doc.filePath,
  };
}

export function meetingToSearchItem(
  meeting: Meeting,
  workspaceName?: string,
  projectName?: string
): SearchItem {
  return {
    id: meeting.id,
    type: "meeting",
    title: meeting.title,
    content: meeting.content?.slice(0, 200) ?? "",
    workspaceId: meeting.workspaceId,
    workspaceName,
    projectId: meeting.projectId,
    projectName,
    created: meeting.created,
    filePath: meeting.filePath,
  };
}

export function projectToSearchItem(
  project: Project,
  workspaceName?: string
): SearchItem {
  return {
    id: project.id,
    type: "project",
    title: project.name,
    content: project.description ?? "",
    workspaceId: project.workspaceId,
    workspaceName,
    projectId: project.id,
    projectName: project.name,
    status: project.status,
    created: project.created,
  };
}
