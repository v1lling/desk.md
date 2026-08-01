import type { ProjectStatus, TaskPriority, TaskStatus } from "../../types";

export type AgentEntryType = "doc" | "task" | "meeting" | "asset" | "unknown";
export type AgentAuthor = "user" | "ai";
export type AgentScope = "workspace" | "project";

export interface AgentWorkspaceRef {
  id: string;
  name: string;
  description?: string;
  is_home?: boolean;
}

export interface AgentProjectRef {
  id: string;
  name: string;
  status?: ProjectStatus;
  description?: string;
}

export interface AgentOverview {
  path: string;
  content?: string;
  overview_excluded: boolean;
  total_chars: number;
  returned_chars: number;
  truncated: boolean;
}

export interface AgentCatalogEntry {
  workspace_id: string;
  workspace_name: string;
  path: string;
  type: AgentEntryType;
  title: string;
  project_id?: string;
  project_name?: string;
  scope: AgentScope;
  author?: AgentAuthor;
  created?: string;
  updated?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due?: string;
  date?: string;
  summary?: string;
  extension?: string;
  mime_type?: string;
  size_bytes?: number;
  warning?: "unparseable_content" | "noncanonical_markdown";
}

export interface AgentCatalogQuery {
  workspace: string;
  project?: string;
  type?: AgentEntryType;
  status?: TaskStatus;
  author?: AgentAuthor;
  since?: string;
  until?: string;
  path_prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface AgentCatalogResult {
  workspace: AgentWorkspaceRef;
  project?: AgentProjectRef;
  total: number;
  returned: number;
  has_more: boolean;
  next_cursor?: string;
  scan_truncated: boolean;
  summaries: { fresh: number; stale: number; missing: number };
  entries: AgentCatalogEntry[];
}

export interface AgentSearchSnippet {
  line: number;
  text: string;
}

export interface AgentSearchResultEntry extends AgentCatalogEntry {
  rank: number;
  matched_in: ("title" | "path" | "body" | "summary")[];
  snippets: AgentSearchSnippet[];
}

export interface AgentSearchQuery {
  query: string;
  workspace?: string;
  project?: string;
  type?: AgentEntryType;
  status?: TaskStatus;
  author?: AgentAuthor;
  since?: string;
  until?: string;
  path_prefix?: string;
  exact?: boolean;
  limit?: number;
  cursor?: string;
}

export interface AgentSearchResult {
  query: string;
  exact: boolean;
  workspace?: AgentWorkspaceRef;
  project?: AgentProjectRef;
  total: number;
  returned: number;
  has_more: boolean;
  next_cursor?: string;
  files_scanned: number;
  scan_truncated: boolean;
  results: AgentSearchResultEntry[];
}

export interface AgentTaskGroup {
  total: number;
  returned: number;
  truncated: boolean;
  entries: AgentCatalogEntry[];
}

export interface AgentContextQuery {
  workspace?: string;
  project?: string;
  focus?: string;
}

export interface AgentDeskWorkspace extends AgentWorkspaceRef {
  projects: AgentProjectRef[];
  task_counts: Record<TaskStatus, number>;
}

export interface AgentContextResult {
  scope: "desk" | "workspace" | "project";
  custom_instructions?: string;
  custom_instructions_truncated: boolean;
  workspace?: AgentWorkspaceRef;
  project?: AgentProjectRef;
  workspace_overview?: AgentOverview;
  project_overview?: AgentOverview;
  workspaces?: AgentDeskWorkspace[];
  tasks?: {
    counts: Record<TaskStatus, number>;
    doing: AgentTaskGroup;
    waiting: AgentTaskGroup;
    todo: AgentTaskGroup;
    recent_done: AgentTaskGroup;
  };
  documents?: AgentCatalogEntry[];
  meetings?: AgentCatalogEntry[];
  totals: {
    workspaces?: number;
    projects?: number;
    documents?: number;
    meetings?: number;
  };
  limits: Record<string, number>;
  truncated: boolean;
}

export interface AgentReadQuery {
  workspace: string;
  path: string;
  offset?: number;
  max_chars?: number;
}

export interface AgentReadResult {
  workspace: AgentWorkspaceRef;
  path: string;
  content: string;
  offset: number;
  returned_chars: number;
  total_chars: number;
  truncated: boolean;
  next_offset?: number;
}
