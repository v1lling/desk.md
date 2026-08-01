import Fuse from "fuse.js";
import { getStorage } from "../storage";
import { getWorkspaces } from "../workspaces";
import { AgentReadError } from "./errors";
import { buildAgentCatalogSnapshot } from "./catalog";
import {
  decodeCursor,
  effectiveDate,
  encodeCursor,
  isReadableTextPath,
  looksLikeBinaryContent,
  normalizePrefix,
  projectRef,
  resolveAgentScope,
  sha256,
  validateDate,
  workspaceAbsolutePath,
  workspaceRef,
  MAX_SCAN_FILES,
} from "./shared";
import type {
  AgentCatalogEntry,
  AgentProjectRef,
  AgentSearchQuery,
  AgentSearchResult,
  AgentSearchResultEntry,
  AgentSearchSnippet,
  AgentWorkspaceRef,
} from "./types";

interface RankedEntry extends AgentSearchResultEntry {
  _date: string;
}

function normalized(value: string): string {
  return value.toLocaleLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function queryTokens(query: string): string[] {
  return [...new Set(normalized(query).split(/\s+/).filter(Boolean))];
}

function tokenCoverage(value: string, tokens: string[]): number {
  const text = normalized(value);
  return tokens.filter((token) => text.includes(token)).length;
}

function snippetsFor(content: string, rawQuery: string, tokens: string[], exact: boolean): AgentSearchSnippet[] {
  const query = rawQuery.toLocaleLowerCase();
  return content.split("\n")
    .map((text, index) => ({ text: text.trim(), line: index + 1 }))
    .filter(({ text }) => {
      if (!text) return false;
      if (exact) return text.toLocaleLowerCase().includes(query);
      const line = normalized(text);
      return tokens.some((token) => line.includes(token));
    })
    .sort((a, b) => tokenCoverage(b.text, tokens) - tokenCoverage(a.text, tokens) || a.line - b.line)
    .slice(0, 3)
    .map(({ line, text }) => ({ line, text: text.length > 240 ? `${text.slice(0, 240)}…` : text }));
}

function compareRanked(a: RankedEntry, b: RankedEntry): number {
  return a.rank - b.rank || b._date.localeCompare(a._date) ||
    a.workspace_id.localeCompare(b.workspace_id) || a.path.localeCompare(b.path);
}

function afterPosition(
  entry: RankedEntry,
  position: { rank: number; date: string; workspace_id: string; path: string },
): boolean {
  if (entry.rank !== position.rank) return entry.rank > position.rank;
  if (entry._date !== position.date) return entry._date < position.date;
  if (entry.workspace_id !== position.workspace_id) return entry.workspace_id > position.workspace_id;
  return entry.path > position.path;
}

export async function runDeskSearch(query: AgentSearchQuery): Promise<AgentSearchResult> {
  const raw = query.query.trim();
  if (!raw) throw new AgentReadError("invalid_argument", "query cannot be empty");
  if (raw.length > 500) throw new AgentReadError("invalid_argument", "query cannot exceed 500 characters");
  if (query.project && !query.workspace) {
    throw new AgentReadError("invalid_argument", "project requires workspace");
  }
  validateDate(query.since, "since");
  validateDate(query.until, "until");
  if (query.since && query.until && query.since > query.until) {
    throw new AgentReadError("invalid_argument", "since cannot be after until");
  }
  const pathPrefix = normalizePrefix(query.path_prefix);
  const resolved = query.workspace ? await resolveAgentScope(query.workspace, query.project) : undefined;
  const workspace: AgentWorkspaceRef | undefined = resolved ? workspaceRef(resolved.workspace) : undefined;
  const project: AgentProjectRef | undefined = resolved?.project ? projectRef(resolved.project) : undefined;
  const workspaces = resolved ? [resolved.workspace] : await getWorkspaces();
  const tokens = queryTokens(raw);
  const exact = query.exact === true;
  const lowerRaw = raw.toLocaleLowerCase();
  const fingerprint = await sha256({
    query: raw,
    exact,
    workspace: resolved?.workspace.id,
    project: resolved?.project?.id,
    type: query.type,
    status: query.status,
    author: query.author,
    since: query.since,
    until: query.until,
    path_prefix: pathPrefix,
  });
  const position = decodeCursor<{ rank: number; date: string; workspace_id: string; path: string }>(
    query.cursor,
    fingerprint,
  );
  const candidates: AgentCatalogEntry[] = [];
  let scanTruncated = false;

  for (const candidateWorkspace of workspaces) {
    if (candidates.length >= MAX_SCAN_FILES) {
      scanTruncated = true;
      break;
    }
    const snapshot = await buildAgentCatalogSnapshot(candidateWorkspace.id);
    scanTruncated ||= snapshot.scanTruncated;
    for (const entry of snapshot.entries) {
      if (candidates.length >= MAX_SCAN_FILES) {
        scanTruncated = true;
        break;
      }
      if (resolved?.project && entry.project_id !== resolved.project.id) continue;
      if (query.type && entry.type !== query.type) continue;
      if (query.status && entry.status !== query.status) continue;
      if (query.author && entry.author !== query.author) continue;
      const date = effectiveDate(entry).slice(0, 10);
      if (query.since && (!date || date < query.since)) continue;
      if (query.until && (!date || date > query.until)) continue;
      if (pathPrefix && entry.path !== pathPrefix && !entry.path.startsWith(`${pathPrefix}/`)) continue;
      candidates.push(entry);
    }
  }

  const fuzzyScores = new Map<string, number>();
  if (!exact && candidates.length > 0) {
    const fuse = new Fuse(candidates, {
      keys: ["title", "path"],
      includeScore: true,
      threshold: 0.35,
      ignoreLocation: true,
    });
    for (const result of fuse.search(raw)) {
      fuzzyScores.set(`${result.item.workspace_id}\0${result.item.path}`, result.score ?? 1);
    }
  }

  const ranked: RankedEntry[] = [];
  let filesScanned = 0;
  for (const entry of candidates) {
    const title = entry.title.toLocaleLowerCase();
    const path = entry.path.toLocaleLowerCase();
    const summary = entry.summary ?? "";
    const titleCoverage = tokenCoverage(entry.title, tokens);
    const pathCoverage = tokenCoverage(entry.path, tokens);
    const summaryCoverage = tokenCoverage(summary, tokens);
    const key = `${entry.workspace_id}\0${entry.path}`;
    const fuzzy = fuzzyScores.get(key);
    let content = "";
    let bodyCoverage = 0;
    let bodyExact = false;
    if (isReadableTextPath(entry.path)) {
      try {
        content = await getStorage().readTextFile(await workspaceAbsolutePath(entry.workspace_id, entry.path));
        if (looksLikeBinaryContent(content)) {
          content = "";
        } else {
          filesScanned += 1;
          bodyCoverage = tokenCoverage(content, tokens);
          bodyExact = content.toLocaleLowerCase().includes(lowerRaw);
        }
      } catch {
        content = "";
      }
    }

    const titleExact = title === lowerRaw;
    const titlePhrase = title.includes(lowerRaw) || title.startsWith(lowerRaw);
    const pathExact = path.includes(lowerRaw);
    const summaryExact = summary.toLocaleLowerCase().includes(lowerRaw);
    let rank: number | undefined;
    if (titleExact) rank = 1;
    else if (exact && (titlePhrase || pathExact || bodyExact || summaryExact)) rank = 2;
    else if (!exact && (titlePhrase || (tokens.length > 0 && titleCoverage === tokens.length))) rank = 2;
    else if (!exact && (fuzzy !== undefined || pathCoverage > 0)) rank = 3;
    else if (!exact && bodyCoverage > 0) rank = 4;
    else if (!exact && summaryCoverage > 0) rank = 5;
    if (rank === undefined) continue;

    const matchedIn: AgentSearchResultEntry["matched_in"] = [];
    if (titleExact || titlePhrase || titleCoverage > 0) matchedIn.push("title");
    if (pathExact || pathCoverage > 0 || fuzzy !== undefined) matchedIn.push("path");
    if (bodyExact || bodyCoverage > 0) matchedIn.push("body");
    if (summaryExact || summaryCoverage > 0) matchedIn.push("summary");
    ranked.push({
      ...entry,
      rank,
      matched_in: matchedIn,
      snippets: content ? snippetsFor(content, raw, tokens, exact) : [],
      _date: effectiveDate(entry),
    });
  }

  ranked.sort(compareRanked);
  const remaining = position ? ranked.filter((entry) => afterPosition(entry, position)) : ranked;
  const limit = Math.min(50, Math.max(1, query.limit ?? 20));
  const page = remaining.slice(0, limit);
  const hasMore = remaining.length > page.length;
  const last = page.at(-1);
  const results = page.map(({ _date: _ignored, ...entry }) => entry);
  return {
    query: raw,
    exact,
    workspace,
    project,
    total: ranked.length,
    returned: results.length,
    has_more: hasMore,
    next_cursor: hasMore && last
      ? encodeCursor(fingerprint, {
          rank: last.rank,
          date: last._date,
          workspace_id: last.workspace_id,
          path: last.path,
        })
      : undefined,
    files_scanned: filesScanned,
    scan_truncated: scanTruncated,
    results,
  };
}
