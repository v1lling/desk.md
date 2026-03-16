import { invoke } from "@tauri-apps/api/core";

export interface DeskListEntry {
  name: string;
  entry_type: "dir" | "file" | "other";
}

export interface DeskListResult {
  path: string;
  total: number;
  truncated: boolean;
  entries: DeskListEntry[];
}

export interface DeskReadResult {
  path: string;
  content: string;
  total_chars: number;
  truncated: boolean;
}

export interface DeskSearchMatch {
  path: string;
  line: number;
  text: string;
}

export interface DeskSearchResult {
  query: string;
  path: string;
  total_files_scanned: number;
  truncated: boolean;
  matches: DeskSearchMatch[];
}

export interface DeskIndexSearchHit {
  path: string;
  title: string;
  summary: string;
  score: number;
}

export interface DeskIndexSearchResult {
  workspace_id: string;
  source: string;
  query: string;
  results: DeskIndexSearchHit[];
}

export interface DeskWorkspaceInfo {
  id: string;
  name: string;
  projects: string[];
}

export interface DeskWorkspaceInfoResult {
  data_root: string;
  workspaces: DeskWorkspaceInfo[];
}

export function deskList(path?: string): Promise<DeskListResult> {
  return invoke<DeskListResult>("desk_list", { path });
}

export function deskRead(path: string): Promise<DeskReadResult> {
  return invoke<DeskReadResult>("desk_read", { path });
}

export function deskSearch(query: string, path?: string): Promise<DeskSearchResult> {
  return invoke<DeskSearchResult>("desk_search", { query, path });
}

export function deskIndexSearch(query: string, workspaceId?: string, limit?: number): Promise<DeskIndexSearchResult> {
  return invoke<DeskIndexSearchResult>("desk_index_search", {
    query,
    workspaceId,
    limit,
  });
}

export function deskWorkspaceInfo(workspaceId?: string): Promise<DeskWorkspaceInfoResult> {
  return invoke<DeskWorkspaceInfoResult>("desk_workspace_info", { workspaceId });
}
