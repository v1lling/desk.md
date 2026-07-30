/**
 * The maintenance engine — "AI maintenance runs where the data lives."
 *
 * Started by exactly one host per deployment:
 *   - local mode  → the app (main.tsx, when `isLocalDisk()`), consent-gated, Keychain key
 *   - hosted mode → the server (index.ts after boot()), env key; configuring a key IS consent
 * Native-remote and web clients never start it — their writes arrive at the server's domain
 * and trigger the server's engine.
 *
 * Trigger: the domain-write bus (every record write on this host — app UI, editor saves via
 * `saveMarkdownBody`, RPC, future MCP write tools) plus, in local mode, the Tauri watcher
 * feeding EXTERNAL file edits through `notifyExternalChanges`. The app's own funnel writes
 * arrive on both channels there; the debounce absorbs the double-fire.
 *
 * Reactions (classified via path-identity; `task`/`doc`/`meeting` only — `context` never
 * schedules):
 *   - per-path debounce (5s)      → Smart Index entry update
 *     (delete/move-away → entry removal, batched per workspace into one index rewrite)
 *
 * Module-level Map debounces are correct here: one long-lived process per host (Tauri window /
 * single server container). A pending debounce dies with the process; drift is caught by the
 * next record write.
 */
import { onDomainWrite, type DomainWriteEvent } from "../domain-write-bus";
import { getItemTypeFromPath, getWorkspaceIdFromPath } from "../path-identity";
import { getAIKeyResolver } from "../ai/key-resolver";
import type { AIProviderType } from "../ai/types";
import { PROVIDER_REGISTRY } from "../ai/provider-registry";
import { updateIndexForFile } from "./index-updater";
import { removeIndexEntries } from "./index-store-io";

const INDEX_DEBOUNCE_MS = 5_000;

export interface MaintenanceEngineOptions {
  /** Host consent gate for AI calls. Default: () => true (server — env key IS consent). */
  canRunAI?: () => boolean | Promise<boolean>;
  /** App hook: rehydrate the index store + regenerate WORKSPACE_INDEX.md after an entry write. */
  onIndexWritten?: (workspaceId: string) => void;
}

let unsubscribe: (() => void) | null = null;
let engineOptions: Required<Pick<MaintenanceEngineOptions, "canRunAI">> & MaintenanceEngineOptions = {
  canRunAI: () => true,
};

const pendingIndexUpdates = new Map<string, ReturnType<typeof setTimeout>>();
// Removals batch per WORKSPACE (one timer + one Set of paths), not per path: a project or
// workspace delete publishes one event per contained record, and per-path handling would mean
// N timers and N full rewrites of the shared index file (O(N²) on a 3,000-record workspace).
const pendingIndexRemovals = new Map<string, ReturnType<typeof setTimeout>>();
const queuedRemovalPaths = new Map<string, Set<string>>();
// In-flight guard, keyed by file path. The debounce only dedupes PENDING timers; once one
// fires, the operation itself can spend seconds in an AI call. Without ordering, a delete
// firing during a slow update would remove the entry first and the finished update would
// re-insert it — a permanent ghost the next rebuild is the only cure for.
const inFlightIndexOps = new Map<string, Promise<unknown>>();

function trackIndexOp(filePath: string, run: Promise<unknown>): void {
  const tracked = run.finally(() => {
    if (inFlightIndexOps.get(filePath) === tracked) inFlightIndexOps.delete(filePath);
  });
  // The .finally chain re-throws; swallow here so the tracker itself can't become an
  // unhandled rejection (the real handlers are attached by the schedulers below).
  tracked.catch(() => undefined);
  inFlightIndexOps.set(filePath, tracked);
}

function scheduleIndexUpdate(workspaceId: string, filePath: string): void {
  // A re-created path cancels its queued removal (e.g. a move back within the window).
  queuedRemovalPaths.get(workspaceId)?.delete(filePath);

  const existing = pendingIndexUpdates.get(filePath);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(() => {
    pendingIndexUpdates.delete(filePath);
    const prev = inFlightIndexOps.get(filePath) ?? Promise.resolve();
    // Chain onto whatever is still running for this path so operations apply in the order
    // they were scheduled (see inFlightIndexOps above).
    const run = prev.then(() => updateIndexForFile(filePath, engineOptions.canRunAI));
    trackIndexOp(filePath, run);
    // .catch is load-bearing: on Node 22 an unhandled rejection kills the hosted server.
    run
      .then(() => {
        engineOptions.onIndexWritten?.(workspaceId);
      })
      .catch((error) => {
        console.warn(`[maintenance] Index update failed for ${filePath}:`, error);
      });
  }, INDEX_DEBOUNCE_MS);

  pendingIndexUpdates.set(filePath, timeout);
}

function scheduleIndexRemoval(workspaceId: string, filePath: string): void {
  // A pending update for a path being removed would run against a missing file — drop it.
  const pendingUpdate = pendingIndexUpdates.get(filePath);
  if (pendingUpdate) {
    clearTimeout(pendingUpdate);
    pendingIndexUpdates.delete(filePath);
  }

  let queued = queuedRemovalPaths.get(workspaceId);
  if (!queued) {
    queued = new Set();
    queuedRemovalPaths.set(workspaceId, queued);
  }
  queued.add(filePath);

  const existing = pendingIndexRemovals.get(workspaceId);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(() => {
    pendingIndexRemovals.delete(workspaceId);
    const paths = [...(queuedRemovalPaths.get(workspaceId) ?? [])];
    queuedRemovalPaths.delete(workspaceId);
    if (paths.length === 0) return;

    // Wait out any in-flight update for these paths first — removal must land AFTER it.
    const prev = Promise.allSettled(
      paths.map((p) => inFlightIndexOps.get(p)).filter((p): p is Promise<unknown> => !!p),
    );
    const run = prev.then(() => removeIndexEntries(workspaceId, paths));
    for (const p of paths) trackIndexOp(p, run);
    run
      .then(() => {
        engineOptions.onIndexWritten?.(workspaceId);
      })
      .catch((error) => {
        console.warn(`[maintenance] Index removal failed for ${workspaceId}:`, error);
      });
  }, INDEX_DEBOUNCE_MS);

  pendingIndexRemovals.set(workspaceId, timeout);
}

function reactToChange(filePath: string, removed: boolean): void {
  const itemType = getItemTypeFromPath(filePath);
  if (itemType !== "task" && itemType !== "doc" && itemType !== "meeting") return;
  const workspaceId = getWorkspaceIdFromPath(filePath);
  if (!workspaceId) return;

  if (removed) scheduleIndexRemoval(workspaceId, filePath);
  else scheduleIndexUpdate(workspaceId, filePath);
}

function handleDomainWrite(event: DomainWriteEvent): void {
  if (event.kind === "move" && event.targetPath) {
    reactToChange(event.filePath, true);
    reactToChange(event.targetPath, false);
    return;
  }
  reactToChange(event.filePath, event.kind === "delete");
}

/**
 * Idempotent: a second call is a no-op. Options are deliberately NOT re-merged on it — a bare
 * `startMaintenanceEngine()` re-merging the always-true default over an app-provided `canRunAI`
 * would silently wipe the privacy consent gate.
 */
export function startMaintenanceEngine(options: MaintenanceEngineOptions = {}): void {
  if (unsubscribe) return;
  engineOptions = { canRunAI: () => true, ...options };
  unsubscribe = onDomainWrite(handleDomainWrite);
}

/** Stop the engine and discard scheduled work. Used when disposing a runtime. */
export function resetMaintenanceEngine(): void {
  unsubscribe?.();
  unsubscribe = null;
  for (const timeout of pendingIndexUpdates.values()) clearTimeout(timeout);
  for (const timeout of pendingIndexRemovals.values()) clearTimeout(timeout);
  pendingIndexUpdates.clear();
  pendingIndexRemovals.clear();
  queuedRemovalPaths.clear();
  inFlightIndexOps.clear();
  engineOptions = { canRunAI: () => true };
}

/**
 * External-edit feed (local mode): the Tauri watcher pipes changed paths here so files written
 * by external agents get the same maintenance as app writes. The engine classifies internally;
 * uninteresting paths are dropped.
 */
export function notifyExternalChanges(paths: string[], kind: "modify" | "remove" = "modify"): void {
  if (!unsubscribe) return;
  for (const path of paths) {
    reactToChange(path, kind === "remove");
  }
}

export interface AIMaintenanceInfo {
  /** Which providers have a key resolvable on the host that owns the data. */
  providerConfigured: Record<AIProviderType, boolean>;
  /** Whether the maintenance engine is running on that host. */
  running: boolean;
}

/**
 * Truthful AI state for the Settings UI, from the host that owns the data (a DeskService
 * method, so remote clients see the SERVER's keys and engine, not their own).
 */
export async function getAIMaintenanceInfo(): Promise<AIMaintenanceInfo> {
  const resolver = getAIKeyResolver();
  const entries = await Promise.all(
    (Object.keys(PROVIDER_REGISTRY) as AIProviderType[]).map(async (provider) => {
      const key = await resolver(PROVIDER_REGISTRY[provider].keyRef);
      return [provider, !!key] as const;
    }),
  );
  return {
    providerConfigured: Object.fromEntries(entries) as Record<AIProviderType, boolean>,
    running: unsubscribe !== null,
  };
}
