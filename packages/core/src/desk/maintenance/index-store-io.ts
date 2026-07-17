/**
 * Direct read/mutate/write access to the persisted Smart Index (`.desk/index/indexes.json`).
 *
 * Core is the SOLE writer of this file (the maintenance engine on whichever host owns the data,
 * plus the app's local rebuild calling `writeWorkspaceIndex` in-process). The app UI never
 * writes it — it reads through a TanStack query (`useSmartIndex`) and re-reads on invalidation.
 * That is why the on-disk shape is plain `{ indexes }` and not a zustand persist envelope: with
 * one writer there is no store to keep a `{state, version}` payload well-formed for.
 *
 * All mutations serialize through one promise chain: the whole index is a single JSON file, so
 * two concurrent read-modify-write cycles (e.g. debounced updates for two files firing together
 * during a bulk import) would silently drop the first write. Reads stay unqueued — a stale read
 * costs at most a redundant re-summary, never data.
 */
import type { IndexEntry, WorkspaceIndex } from "../catalog/types";
import { getIndexCache, setIndexCache } from "../index-cache";

/** On-disk shape of `.desk/index/indexes.json` — plain, no persist envelope. */
interface IndexFile {
  indexes: Record<string, WorkspaceIndex>;
}

let mutationChain: Promise<unknown> = Promise.resolve();

/** Serialize read-modify-write cycles on the shared index file. */
function enqueueMutation<T>(fn: () => Promise<T>): Promise<T> {
  const run = mutationChain.then(fn, fn);
  mutationChain = run.catch(() => undefined);
  return run;
}

async function readIndexFile(): Promise<IndexFile> {
  try {
    const raw = await getIndexCache();
    if (!raw) return { indexes: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { indexes: {} };
    const p = parsed as { indexes?: Record<string, WorkspaceIndex> };
    return { indexes: p.indexes ?? {} };
  } catch {
    return { indexes: {} };
  }
}

async function writeIndexFile(file: IndexFile): Promise<void> {
  await setIndexCache(JSON.stringify(file));
}

export async function readWorkspaceIndex(workspaceId: string): Promise<WorkspaceIndex | undefined> {
  const file = await readIndexFile();
  return file.indexes[workspaceId];
}

export function writeWorkspaceIndex(index: WorkspaceIndex): Promise<void> {
  return enqueueMutation(async () => {
    const file = await readIndexFile();
    file.indexes[index.workspaceId] = index;
    await writeIndexFile(file);
  });
}

/** The fields the incremental updater changes — used to detect writes that raced a rebuild. */
function entrySig(e: IndexEntry): string {
  return JSON.stringify([
    e.contentHash,
    e.summary ?? null,
    e.title,
    e.updated ?? null,
    e.status ?? null,
    e.priority ?? null,
  ]);
}

/**
 * Persist a full rebuild WITHOUT clobbering incremental writes that landed while it ran.
 *
 * A rebuild snapshots the catalog, then spends potentially minutes in AI batch calls; only its
 * final write sits in the mutation chain, so its entries are stale by construction. Wholesale
 * `writeWorkspaceIndex` would silently drop any entry the engine upserted (or removed) in that
 * window — a doc created mid-rebuild vanishes from the index until its file is written again.
 *
 * Merge rule, per path, comparing the CURRENT on-disk index against the PRE-rebuild snapshot:
 * an entry the updater touched during the rebuild (differs from — or is absent in — the
 * snapshot) wins over the rebuilt entry; anything untouched takes the rebuild's version,
 * including its disappearance (deleted / newly `.aiignore`d files stay dropped).
 */
export function writeRebuiltWorkspaceIndex(
  index: WorkspaceIndex,
  preRebuild: WorkspaceIndex | undefined,
): Promise<void> {
  return enqueueMutation(async () => {
    const file = await readIndexFile();
    const current = file.indexes[index.workspaceId];
    file.indexes[index.workspaceId] = current
      ? mergeRebuiltIndex(index, preRebuild, current)
      : index;
    await writeIndexFile(file);
  });
}

function mergeRebuiltIndex(
  rebuilt: WorkspaceIndex,
  pre: WorkspaceIndex | undefined,
  current: WorkspaceIndex,
): WorkspaceIndex {
  const preSigs = new Map((pre?.entries ?? []).map((e) => [e.filePath, entrySig(e)]));
  const rebuiltByPath = new Map(rebuilt.entries.map((e) => [e.filePath, e]));
  const merged: IndexEntry[] = [];
  const seen = new Set<string>();

  for (const cur of current.entries) {
    seen.add(cur.filePath);
    const preSig = preSigs.get(cur.filePath);
    const touchedDuringRebuild = preSig === undefined || preSig !== entrySig(cur);
    const fromRebuild = rebuiltByPath.get(cur.filePath);
    if (touchedDuringRebuild) merged.push(cur);
    else if (fromRebuild) merged.push(fromRebuild);
    // else: untouched since the snapshot and absent from the rebuild → deleted/excluded, drop.
  }

  for (const entry of rebuilt.entries) {
    if (seen.has(entry.filePath)) continue;
    // Absent from the live index: removed by the updater DURING the rebuild (the snapshot had
    // it) → respect the removal; genuinely discovered by the rebuild → keep.
    if (!preSigs.has(entry.filePath)) merged.push(entry);
  }

  return { ...rebuilt, entries: merged, fileCount: merged.length };
}

/** Insert or replace one entry (matched on absolute filePath), bumping counters. */
export function upsertIndexEntry(workspaceId: string, entry: IndexEntry): Promise<void> {
  return enqueueMutation(async () => {
    const file = await readIndexFile();
    const index = file.indexes[workspaceId];
    if (!index) {
      // No index yet for this workspace: seed a minimal one so background updates work before
      // the first full rebuild.
      const now = new Date().toISOString();
      file.indexes[workspaceId] = {
        workspaceId,
        workspaceName: workspaceId,
        entries: [entry],
        builtAt: now,
        updatedAt: now,
        fileCount: 1,
      };
    } else {
      const i = index.entries.findIndex((e) => e.filePath === entry.filePath);
      if (i >= 0) index.entries[i] = entry;
      else index.entries.push(entry);
      index.fileCount = index.entries.length;
      index.updatedAt = new Date().toISOString();
    }
    await writeIndexFile(file);
  });
}

export function removeIndexEntry(workspaceId: string, filePath: string): Promise<void> {
  return removeIndexEntries(workspaceId, [filePath]);
}

/**
 * Remove many entries in ONE read-modify-write. A project/workspace delete fires one event per
 * contained record; removing them one enqueued rewrite each would be O(N²) serialization work
 * on the whole index file.
 */
export function removeIndexEntries(workspaceId: string, filePaths: readonly string[]): Promise<void> {
  return enqueueMutation(async () => {
    const file = await readIndexFile();
    const index = file.indexes[workspaceId];
    if (!index) return;
    const remove = new Set(filePaths);
    const before = index.entries.length;
    index.entries = index.entries.filter((e) => !remove.has(e.filePath));
    if (index.entries.length === before) return;
    index.fileCount = index.entries.length;
    index.updatedAt = new Date().toISOString();
    await writeIndexFile(file);
  });
}

/** Wipe one workspace's entries from the index file (Settings → clear catalog). */
export function clearWorkspaceIndex(workspaceId: string): Promise<void> {
  return enqueueMutation(async () => {
    const file = await readIndexFile();
    if (!file.indexes[workspaceId]) return;
    delete file.indexes[workspaceId];
    await writeIndexFile(file);
  });
}
