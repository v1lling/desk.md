/**
 * Smart Index cache I/O — the structured catalog (`.desk/index/indexes.json`).
 *
 * DERIVED state (rebuildable from the markdown), but it is exposed through the
 * DeskService so it *follows the domain*: in hosted mode the catalog lands on the
 * server next to the data, where the in-app catalog tool and (later) MCP read it.
 * Kept separate from the user-settings KV (settings.ts) because it is a cache, not
 * a user setting, and keeps its own `.desk/index/` home.
 *
 * The value is an opaque JSON string (the zustand persist payload), written whole
 * on each build / save-debounce and read once at hydrate — never per-entry.
 */
import { getDeskPath, joinPath } from "./env";
import { getStorage } from "./storage";

const INDEX_FILE = "indexes.json";

async function indexDir(): Promise<string> {
  const deskPath = await getDeskPath();
  return joinPath(deskPath, ".desk", "index");
}

export async function getIndexCache(): Promise<string | null> {
  const path = await joinPath(await indexDir(), INDEX_FILE);
  if (!(await getStorage().exists(path))) return null;
  const content = await getStorage().readTextFile(path);
  return content || null;
}

export async function setIndexCache(value: string): Promise<void> {
  const dir = await indexDir();
  if (!(await getStorage().exists(dir))) await getStorage().mkdir(dir);
  const path = await joinPath(dir, INDEX_FILE);
  await getStorage().writeTextFile(path, value);
}
