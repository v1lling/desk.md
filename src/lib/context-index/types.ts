export interface IndexEntry {
  /** Workspace-relative path (e.g. "projects/website/docs/api-spec.md") */
  path: string;
  /** Absolute file path for reading */
  filePath: string;
  /** Content type */
  type: 'doc' | 'task' | 'meeting';
  /** Title from frontmatter */
  title: string;
  /** AI-generated 1-2 sentence summary */
  summary: string;
  /** SHA-256 hash of file content (for incremental rebuild) */
  contentHash: string;
  /** ISO date created */
  created: string;
  /** Project ID this belongs to */
  projectId: string;
  /** Project name (resolved) */
  projectName?: string;
  // Task-specific
  status?: string;
  priority?: string;
  // Meeting-specific
  date?: string;
  attendees?: string[];
}

export interface WorkspaceIndex {
  workspaceId: string;
  workspaceName: string;
  entries: IndexEntry[];
  builtAt: string;
  fileCount: number;
}

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
