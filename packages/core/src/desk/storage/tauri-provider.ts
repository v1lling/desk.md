/**
 * TauriProvider — StorageProvider backed by the Tauri fs plugin (desktop).
 *
 * Carries the desktop-only concerns that used to live in tauri-fs.ts: lazy
 * loading of @tauri-apps/plugin-fs, and the hidden-path scope grant
 * (ensureHiddenPathAllowed) needed because the runtime fs scope cannot
 * glob-match dot-prefixed path segments.
 */
import type { DirEntry, FileStat, StorageProvider } from "./provider";

// Lazy import the Tauri fs module only when first needed.
async function getTauriFsModule() {
  return import("@tauri-apps/plugin-fs");
}

// Paths already granted via allow_data_path — skip repeat invokes.
const allowedHiddenPaths = new Set<string>();

/**
 * Ensure a hidden (dot-prefixed) path is allowed by the Tauri fs scope.
 *
 * The fs capabilities defer to the runtime global scope, which on macOS/Linux
 * cannot glob-match path components starting with "." (the `dataDir/**` entry from
 * expandFsScope() excludes them). Before any fs op on a path with a hidden segment,
 * we ask the backend for a literal allow entry, which does match dotfiles. The
 * backend rejects anything outside the data root — that containment check is the
 * security boundary.
 */
async function ensureHiddenPathAllowed(path: string): Promise<void> {
  if (!path.includes("/.")) return; // fast check: no hidden segment
  if (allowedHiddenPaths.has(path)) return; // cache hit

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("allow_data_path", { path });
    allowedHiddenPaths.add(path);
  } catch (err) {
    console.error("[tauri-fs] allow_data_path failed for", path, err);
    // Continue — the fs call below will surface a clearer error if still denied.
  }
}

export class TauriProvider implements StorageProvider {
  async exists(path: string): Promise<boolean> {
    await ensureHiddenPathAllowed(path);
    const fs = await getTauriFsModule();
    return fs.exists(path);
  }

  async readTextFile(path: string): Promise<string> {
    await ensureHiddenPathAllowed(path);
    const fs = await getTauriFsModule();
    return fs.readTextFile(path);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await ensureHiddenPathAllowed(path);
    const fs = await getTauriFsModule();
    await fs.writeTextFile(path, content);
  }

  async writeFile(path: string, bytes: Uint8Array): Promise<void> {
    await ensureHiddenPathAllowed(path);
    const fs = await getTauriFsModule();
    await fs.writeFile(path, bytes);
  }

  async mkdir(path: string): Promise<void> {
    await ensureHiddenPathAllowed(path);
    const fs = await getTauriFsModule();
    await fs.mkdir(path, { recursive: true });
  }

  async removeFile(path: string): Promise<void> {
    await ensureHiddenPathAllowed(path);
    const fs = await getTauriFsModule();
    await fs.remove(path);
  }

  async removeDir(path: string): Promise<void> {
    await ensureHiddenPathAllowed(path);
    const fs = await getTauriFsModule();
    await fs.remove(path, { recursive: true });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await ensureHiddenPathAllowed(oldPath);
    await ensureHiddenPathAllowed(newPath);
    const fs = await getTauriFsModule();
    await fs.rename(oldPath, newPath);
  }

  async readDir(path: string): Promise<DirEntry[]> {
    await ensureHiddenPathAllowed(path);
    const fs = await getTauriFsModule();
    const entries = await fs.readDir(path);
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory,
      isFile: entry.isFile,
    }));
  }

  async fileStat(path: string): Promise<FileStat | null> {
    try {
      await ensureHiddenPathAllowed(path);
      const fs = await getTauriFsModule();
      const info = await fs.stat(path);
      return {
        birthtime: info.birthtime,
        mtime: info.mtime,
        size: info.size,
      };
    } catch {
      return null;
    }
  }
}
