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
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { DirEntry, FileStat, StorageProvider } from "@desk/core/host";

export class NodeFsProvider implements StorageProvider {
  private readonly root: string;
  private readonly realRoot: string;

  constructor(root: string) {
    this.root = resolve(root);
    this.realRoot = realpathSync(this.root);
  }

  /**
   * First containment layer: collapse lexical `..` segments and reject paths
   * outside the configured root. Existing paths and write parents receive a
   * second, realpath-based check below to account for symlinks.
   */
  private within(p: string): string {
    const abs = resolve(p);
    const rel = relative(this.root, abs);
    if (isOutside(rel)) {
      throw new Error(`Path escapes data root: ${p}`);
    }
    return abs;
  }

  private assertRealWithin(realPath: string, requestedPath: string): void {
    const rel = relative(this.realRoot, realPath);
    if (isOutside(rel)) {
      throw new Error(`Path escapes data root: ${requestedPath}`);
    }
  }

  /** Validate an existing path after resolving every symlink in it. */
  private async existingWithin(p: string): Promise<string> {
    const abs = this.within(p);
    // lstat makes a dangling final symlink distinguishable from a genuinely
    // missing path. A dangling symlink must be rejected, never treated as a
    // safe new write target.
    await lstat(abs);
    let real: string;
    try {
      real = await realpath(abs);
    } catch {
      throw new Error(`Path escapes data root: ${p}`);
    }
    this.assertRealWithin(real, p);
    return abs;
  }

  /**
   * Validate a write target. Existing targets are fully resolved; new targets
   * validate their nearest existing ancestor so an intermediate directory
   * symlink cannot redirect a write outside the data root.
   */
  private async writableWithin(p: string): Promise<string> {
    const abs = this.within(p);
    try {
      return await this.existingWithin(abs);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }

    let ancestor = dirname(abs);
    while (true) {
      try {
        await lstat(ancestor);
        let realAncestor: string;
        try {
          realAncestor = await realpath(ancestor);
        } catch {
          throw new Error(`Path escapes data root: ${p}`);
        }
        this.assertRealWithin(realAncestor, p);
        return abs;
      } catch (error) {
        if (!isNotFoundError(error)) throw error;
      }

      const parent = dirname(ancestor);
      if (parent === ancestor) {
        throw new Error(`Path escapes data root: ${p}`);
      }
      ancestor = parent;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      const safePath = await this.existingWithin(path);
      await access(safePath);
      return true;
    } catch {
      return false;
    }
  }

  async readTextFile(path: string): Promise<string> {
    return readFile(await this.existingWithin(path), "utf8");
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await writeFile(await this.writableWithin(path), content, "utf8");
  }

  async writeFile(path: string, bytes: Uint8Array): Promise<void> {
    await writeFile(await this.writableWithin(path), bytes);
  }

  async mkdir(path: string): Promise<void> {
    await mkdir(await this.writableWithin(path), { recursive: true });
  }

  async removeFile(path: string): Promise<void> {
    await rm(await this.writableWithin(path), { force: true });
  }

  async removeDir(path: string): Promise<void> {
    await rm(await this.writableWithin(path), { recursive: true, force: true });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await rename(
      await this.existingWithin(oldPath),
      await this.writableWithin(newPath),
    );
  }

  async readDir(path: string): Promise<DirEntry[]> {
    const entries = await readdir(await this.existingWithin(path), { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      isFile: e.isFile(),
    }));
  }

  async fileStat(path: string): Promise<FileStat | null> {
    try {
      const s = await stat(await this.existingWithin(path));
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

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isOutside(relativePath: string): boolean {
  return (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  );
}
