/**
 * Catalog types — the always-complete, AI-free metadata index.
 *
 * A `CatalogEntry` is pure metadata (path, title, type, dates, status…) derivable
 * from the filesystem + frontmatter with no AI. An `IndexEntry` is a catalog entry
 * plus an *optional* AI `summary` that the app's enrichment pass fills in wherever a
 * key exists. The catalog is buildable anywhere (incl. the server); summaries are an
 * enrichment merged in by `path`.
 */

/** Pure metadata for one content file — no AI summary. */
export interface CatalogEntry {
  /** Workspace-relative path (e.g. "projects/website/docs/api-spec.md") */
  path: string;
  /** Absolute file path for reading */
  filePath: string;
  /**
   * Content type. A lifecycle distinction, not an authorship one:
   * `context` is the evergreen, maintained map (read it first to orient); `doc` / `task` /
   * `meeting` are dated records that accumulate and are never rewritten.
   */
  type: 'doc' | 'context' | 'task' | 'meeting';
  /** Title from frontmatter */
  title: string;
  /** 'ai' when an agent wrote the file; absent means the user did. */
  author?: 'ai';
  /** SHA-256 hash of file body (for incremental summary reuse) */
  contentHash: string;
  /** ISO date created - absent when the file carries no date */
  created?: string;
  /** ISO datetime of the last save (from the `updated` frontmatter stamp) */
  updated?: string;
  /** Project ID this belongs to */
  projectId: string;
  /** Project name (resolved) */
  projectName?: string;
  // Task-specific
  status?: string;
  priority?: string;
  // Meeting-specific
  date?: string;
}

/** A catalog entry enriched with an optional AI summary. */
export interface IndexEntry extends CatalogEntry {
  /** AI-generated 1-2 sentence summary. Absent until a key-bearing client summarizes it. */
  summary?: string;
}

/** The metadata catalog for a workspace (no summaries). */
export interface WorkspaceCatalog {
  workspaceId: string;
  workspaceName: string;
  entries: CatalogEntry[];
  /** ISO timestamp this catalog was built. */
  builtAt: string;
  fileCount: number;
  /** Count of files skipped by `.aiignore` (informational). */
  excluded: number;
}

/** The persisted Smart Index for a workspace (catalog + summaries). */
export interface WorkspaceIndex {
  workspaceId: string;
  workspaceName: string;
  entries: IndexEntry[];
  /** Timestamp of the last full rebuild (set only by buildWorkspaceIndex). */
  builtAt: string;
  /**
   * Timestamp of the last change to this index — bumped by a full rebuild AND by
   * background auto-summary entry updates. Optional for indexes persisted before this
   * field existed; fall back to `builtAt`.
   */
  updatedAt?: string;
  fileCount: number;
}
