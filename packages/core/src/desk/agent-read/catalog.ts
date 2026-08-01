import type { TaskStatus } from "../../types";
import { buildWorkspaceCatalog } from "../catalog";
import type { CatalogEntry, IndexEntry } from "../catalog";
import { readWorkspaceIndex } from "../maintenance/index-store-io";
import { AgentReadError } from "./errors";
import {
  decodeCursor,
  effectiveDate,
  encodeCursor,
  isOverviewPath,
  listVisibleWorkspaceFiles,
  mimeTypeFor,
  normalizePrefix,
  projectIdForPath,
  projectRef,
  resolveAgentScope,
  scopeForProjectId,
  sha256,
  validateDate,
  workspaceRef,
} from "./shared";
import type {
  AgentCatalogEntry,
  AgentCatalogQuery,
  AgentCatalogResult,
  AgentProjectRef,
  AgentWorkspaceRef,
} from "./types";

interface CatalogSnapshot {
  workspace: AgentWorkspaceRef;
  entries: AgentCatalogEntry[];
  scanTruncated: boolean;
  summaries: { fresh: number; stale: number; missing: number };
}

function basename(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.replace(/\.md$/i, "");
}

function isCanonicalContentLocation(path: string): boolean {
  const parts = path.split("/");
  return (
    parts[0] === "docs" ||
    ((parts[0] === "_unassigned" || parts[0] === "_capture") && ["docs", "tasks", "meetings"].includes(parts[1])) ||
    (parts[0] === "projects" && ["docs", "tasks", "meetings"].includes(parts[2]))
  );
}

function toAgentEntry(
  workspace: AgentWorkspaceRef,
  entry: CatalogEntry,
  summary?: string,
): AgentCatalogEntry {
  return {
    workspace_id: workspace.id,
    workspace_name: workspace.name,
    path: entry.path,
    type: entry.type,
    title: entry.title,
    project_id: entry.projectId,
    project_name: entry.projectName,
    scope: scopeForProjectId(entry.projectId),
    author: entry.author === "ai" ? "ai" : "user",
    created: entry.created,
    updated: entry.updated,
    status: entry.status as TaskStatus | undefined,
    priority: entry.priority as AgentCatalogEntry["priority"],
    due: entry.due,
    date: entry.date,
    summary,
  };
}

export async function buildAgentCatalogSnapshot(workspaceSelector: string): Promise<CatalogSnapshot> {
  const { workspace } = await resolveAgentScope(workspaceSelector);
  const ref = workspaceRef(workspace);
  const [base, visible, persisted] = await Promise.all([
    buildWorkspaceCatalog(workspace.id),
    listVisibleWorkspaceFiles(workspace.id),
    readWorkspaceIndex(workspace.id).catch(() => undefined),
  ]);
  const summaries = new Map<string, IndexEntry>(persisted?.entries.map((entry) => [entry.path, entry]) ?? []);
  const summaryCounts = { fresh: 0, stale: 0, missing: 0 };
  const entries: AgentCatalogEntry[] = [];
  const canonicalPaths = new Set<string>();

  for (const entry of base.entries) {
    canonicalPaths.add(entry.path);
    const indexed = summaries.get(entry.path);
    let summary: string | undefined;
    if (indexed?.summary && indexed.contentHash === entry.contentHash) {
      summary = indexed.summary;
      summaryCounts.fresh += 1;
    } else if (indexed?.summary) {
      summaryCounts.stale += 1;
    } else {
      summaryCounts.missing += 1;
    }
    entries.push(toAgentEntry(ref, entry, summary));
  }

  for (const file of visible.files) {
    if (canonicalPaths.has(file.path) || isOverviewPath(file.path)) continue;
    const projectId = projectIdForPath(file.path);
    const common = {
      workspace_id: ref.id,
      workspace_name: ref.name,
      path: file.path,
      title: basename(file.path),
      project_id: projectId,
      scope: scopeForProjectId(projectId),
      extension: file.extension,
      mime_type: mimeTypeFor(file.extension),
      size_bytes: file.size,
    } satisfies Partial<AgentCatalogEntry>;
    if (file.extension === "md") {
      entries.push({
        ...common,
        type: "unknown",
        warning: isCanonicalContentLocation(file.path) ? "unparseable_content" : "noncanonical_markdown",
      } as AgentCatalogEntry);
    } else {
      entries.push({ ...common, type: "asset" } as AgentCatalogEntry);
    }
  }

  return { workspace: ref, entries, scanTruncated: visible.truncated, summaries: summaryCounts };
}

function compareEntries(a: AgentCatalogEntry, b: AgentCatalogEntry): number {
  return effectiveDate(b).localeCompare(effectiveDate(a)) || a.path.localeCompare(b.path);
}

function afterPosition(entry: AgentCatalogEntry, position: { date: string; path: string }): boolean {
  const date = effectiveDate(entry);
  return date < position.date || (date === position.date && entry.path > position.path);
}

export async function runDeskCatalog(query: AgentCatalogQuery): Promise<AgentCatalogResult> {
  validateDate(query.since, "since");
  validateDate(query.until, "until");
  if (query.since && query.until && query.since > query.until) {
    throw new AgentReadError("invalid_argument", "since cannot be after until");
  }
  const pathPrefix = normalizePrefix(query.path_prefix);
  const scope = await resolveAgentScope(query.workspace, query.project);
  const snapshot = await buildAgentCatalogSnapshot(scope.workspace.id);
  const project: AgentProjectRef | undefined = scope.project ? projectRef(scope.project) : undefined;
  const projectId = scope.project?.id;
  const fingerprint = await sha256({
    workspace: scope.workspace.id,
    project: projectId,
    type: query.type,
    status: query.status,
    author: query.author,
    since: query.since,
    until: query.until,
    path_prefix: pathPrefix,
  });
  const position = decodeCursor<{ date: string; path: string }>(query.cursor, fingerprint);
  const filtered = snapshot.entries
    .filter((entry) => !projectId || entry.project_id === projectId)
    .filter((entry) => !query.type || entry.type === query.type)
    .filter((entry) => !query.status || entry.status === query.status)
    .filter((entry) => !query.author || entry.author === query.author)
    .filter((entry) => {
      const date = effectiveDate(entry).slice(0, 10);
      return !query.since || Boolean(date && date >= query.since);
    })
    .filter((entry) => {
      const date = effectiveDate(entry).slice(0, 10);
      return !query.until || Boolean(date && date <= query.until);
    })
    .filter((entry) => !pathPrefix || entry.path === pathPrefix || entry.path.startsWith(`${pathPrefix}/`))
    .sort(compareEntries);
  const remaining = position ? filtered.filter((entry) => afterPosition(entry, position)) : filtered;
  const limit = Math.min(200, Math.max(1, query.limit ?? 50));
  const entries = remaining.slice(0, limit);
  const hasMore = remaining.length > entries.length;
  const last = entries.at(-1);

  return {
    workspace: snapshot.workspace,
    project,
    total: filtered.length,
    returned: entries.length,
    has_more: hasMore,
    next_cursor: hasMore && last
      ? encodeCursor(fingerprint, { date: effectiveDate(last), path: last.path })
      : undefined,
    scan_truncated: snapshot.scanTruncated,
    summaries: snapshot.summaries,
    entries,
  };
}
