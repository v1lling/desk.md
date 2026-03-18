import { invoke } from "@tauri-apps/api/core";

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

export interface DeskWorkspaceInfo {
  id: string;
  name: string;
  projects: string[];
}

export interface DeskWorkspaceInfoResult {
  data_root: string;
  workspaces: DeskWorkspaceInfo[];
}

export function deskRead(path: string): Promise<DeskReadResult> {
  return invoke<DeskReadResult>("desk_read", { path });
}

export function deskSearch(query: string, path?: string): Promise<DeskSearchResult> {
  return invoke<DeskSearchResult>("desk_search", { query, path });
}

export function deskWorkspaceInfo(workspaceId?: string): Promise<DeskWorkspaceInfoResult> {
  return invoke<DeskWorkspaceInfoResult>("desk_workspace_info", { workspaceId });
}
