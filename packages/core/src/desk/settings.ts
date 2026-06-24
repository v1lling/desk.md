/**
 * Shared settings store — a generic key/value of user-level settings persisted as
 * JSON files under `.desk/settings/<key>.json`.
 *
 * This is the "follows the user" home for non-content settings (templates, agent
 * instructions, the week planner): because reads/writes go through getStorage() and
 * these functions are exposed on DeskService (SEAM 2), they live on the *server's*
 * disk in hosted mode (shared across devices) and on local disk otherwise — exactly
 * like content. Device-level UI state (tabs, sidebar widths, theme) stays in
 * localStorage instead and never reaches here.
 *
 * Values are opaque JSON strings: the caller (a zustand persist adapter) already
 * serializes, so this layer just stores the bytes.
 */
import { getDeskPath, joinPath } from "./env";
import { getStorage } from "./storage";

// Keys are code-defined constants, never user input. Guard anyway: these args
// arrive over the RPC boundary in hosted mode, and the key becomes a filename, so
// reject anything that could escape `.desk/settings/`.
function assertSafeKey(key: string): void {
  if (!/^[a-z0-9-]+$/i.test(key)) {
    throw new Error(`Invalid setting key: ${key}`);
  }
}

async function settingsDir(): Promise<string> {
  const deskPath = await getDeskPath();
  return joinPath(deskPath, ".desk", "settings");
}

/** Read a setting's raw JSON string, or null if it has never been written. */
export async function getSetting(key: string): Promise<string | null> {
  assertSafeKey(key);
  const path = await joinPath(await settingsDir(), `${key}.json`);
  if (!(await getStorage().exists(path))) {
    return null;
  }
  const content = await getStorage().readTextFile(path);
  return content || null;
}

/** Write a setting's raw JSON string, creating `.desk/settings/` on first write. */
export async function setSetting(key: string, value: string): Promise<void> {
  assertSafeKey(key);
  const dir = await settingsDir();
  if (!(await getStorage().exists(dir))) {
    await getStorage().mkdir(dir);
  }
  const path = await joinPath(dir, `${key}.json`);
  await getStorage().writeTextFile(path, value);
}
