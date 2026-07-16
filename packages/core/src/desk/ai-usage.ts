/**
 * AI usage log — `.desk/usage/ai-usage.json`.
 *
 * A DeskService-routed append log so usage follows the domain: the engine that made the AI call
 * (app in local mode, server in hosted mode) writes here, and the Settings → AI Usage panel
 * reads it through the service in every mode. Plain JSON array — this file replaced the old
 * zustand-persist envelope format when usage moved off the client store (no migration; single
 * user).
 */
import type { AIUsageRecord } from "./ai/types";
import { getStorage } from "./storage";
import { getDeskPath, joinPath } from "./env";

const RETENTION_DAYS = 90;

// Writes serialize through one promise chain (same pattern as the Smart Index store): appends
// are read-modify-write on a single JSON file, and several AI calls finishing together (bulk
// import → many debounced summaries) would otherwise read the same array and clobber each
// other. It also keeps "clear" honest — an in-flight append queued behind the clear appends to
// the emptied list instead of resurrecting the pre-clear records.
let writeChain: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.catch(() => undefined);
  return run;
}

// Monotonic per-process suffix: two appends in the same millisecond (or after pruning shrank
// the list) must not collide — the id is a React key in the Usage panel.
let idCounter = 0;

async function usageFilePath(): Promise<string> {
  const deskPath = await getDeskPath();
  const dir = await joinPath(deskPath, ".desk", "usage");
  // writeTextFile does not create parents.
  await getStorage().mkdir(dir);
  return joinPath(dir, "ai-usage.json");
}

function pruneOld(records: AIUsageRecord[]): AIUsageRecord[] {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return records.filter((r) => {
    const t = Date.parse(r.timestamp);
    return Number.isNaN(t) ? true : t >= cutoff;
  });
}

export async function getAIUsage(): Promise<AIUsageRecord[]> {
  try {
    const path = await usageFilePath();
    if (!(await getStorage().exists(path))) return [];
    const raw = await getStorage().readTextFile(path);
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AIUsageRecord[]) : [];
  } catch {
    return [];
  }
}

export async function appendAIUsage(
  record: Omit<AIUsageRecord, "id" | "timestamp">,
): Promise<void> {
  try {
    await enqueueWrite(async () => {
      const records = await getAIUsage();
      records.push({
        ...record,
        id: `${Date.now()}-${idCounter++}`,
        timestamp: new Date().toISOString(),
      });
      const path = await usageFilePath();
      await getStorage().writeTextFile(path, JSON.stringify(pruneOld(records)));
    });
  } catch (error) {
    // Telemetry must never break the AI call that produced it.
    console.warn("[ai-usage] Failed to record usage:", error);
  }
}

export function clearAIUsage(): Promise<void> {
  return enqueueWrite(async () => {
    const path = await usageFilePath();
    await getStorage().writeTextFile(path, "[]");
  });
}
