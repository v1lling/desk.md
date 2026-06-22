/**
 * NodeFsProvider — the StorageProvider backed by the server's local filesystem.
 *
 * A direct port of TauriProvider to node:fs/promises: the same 10 raw I/O
 * primitives, minus the Tauri capability-scope dance (the server has plain
 * POSIX access to its data volume). The domain layer runs against this verbatim
 * once boot() calls setStorage(new NodeFsProvider()).
 */
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { DirEntry, FileStat, StorageProvider } from "@desk/core";

export class NodeFsProvider implements StorageProvider {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  /**
   * Containment guard: resolve `p` and confirm it stays within the data root,
   * throwing if it escapes (e.g. a `..`-laden path). Lexical only — deliberately
   * not realpath(), which would reject not-yet-created files in the write/mkdir
   * paths; `..` traversal is the threat, and `path.resolve` collapses it.
   */
  private within(p: string): string {
    const abs = resolve(p);
    const rel = relative(this.root, abs);
    if (rel !== "" && (rel.startsWith("..") || isAbsolute(rel))) {
      throw new Error(`Path escapes data root: ${p}`);
    }
    return abs;
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(this.within(path));
      return true;
    } catch {
      return false;
    }
  }

  async readTextFile(path: string): Promise<string> {
    return readFile(this.within(path), "utf8");
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await writeFile(this.within(path), content, "utf8");
  }

  async writeFile(path: string, bytes: Uint8Array): Promise<void> {
    await writeFile(this.within(path), bytes);
  }

  async mkdir(path: string): Promise<void> {
    await mkdir(this.within(path), { recursive: true });
  }

  async removeFile(path: string): Promise<void> {
    await rm(this.within(path), { force: true });
  }

  async removeDir(path: string): Promise<void> {
    await rm(this.within(path), { recursive: true, force: true });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await rename(this.within(oldPath), this.within(newPath));
  }

  async readDir(path: string): Promise<DirEntry[]> {
    const entries = await readdir(this.within(path), { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      isFile: e.isFile(),
    }));
  }

  async fileStat(path: string): Promise<FileStat | null> {
    try {
      const s = await stat(this.within(path));
      return {
        birthtime: s.birthtime,
        mtime: s.mtime,
        size: s.size,
      };
    } catch {
      return null;
    }
  }
}
