/**
 * Smart Index types.
 *
 * The data shapes (`CatalogEntry`/`IndexEntry`/`WorkspaceCatalog`/`WorkspaceIndex`) now
 * live in `@desk/core` so the core builder, the server, and the app share one source.
 * Re-exported here so existing `./types` importers keep working. The UI-only progress /
 * result shapes stay app-side.
 */
export type {
  CatalogEntry,
  IndexEntry,
  WorkspaceCatalog,
  WorkspaceIndex,
} from "@desk/core";

export interface BuildIndexProgress {
  phase: 'collecting' | 'summarizing' | 'done';
  total: number;
  processed: number;
  newOrChanged: number;
  currentWorkspace?: string;
}

export interface BuildIndexResult {
  totalFiles: number;
  summarized: number;
  reused: number;
  excluded: number;
  errors: string[];
}
