import type { DirEntry, FileStat, StorageProvider } from "./provider";

export interface MemorySeedFile {
  path: string;
  content: string | Uint8Array;
  createdAt?: Date;
  modifiedAt?: Date;
}

interface MemoryFile {
  bytes: Uint8Array;
  birthtime: Date;
  mtime: Date;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function normalizePath(path: string): string {
  const prefix = path.startsWith("/") ? "/" : "";
  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return `${prefix}${parts.join("/")}` || prefix || ".";
}

function parentPath(path: string): string | null {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  if (index < 0) return null;
  if (index === 0) return "/";
  return normalized.slice(0, index);
}

function baseName(path: string): string {
  const normalized = normalizePath(path);
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

function isWithin(path: string, directory: string): boolean {
  return path === directory || path.startsWith(`${directory}/`);
}

/**
 * A deterministic, dependency-free StorageProvider for browser development
 * and domain tests. Its observable behavior intentionally follows normal
 * filesystem expectations: missing reads fail, writes create/replace files,
 * mkdir is recursive, and rename rejects collisions.
 */
export class InMemoryStorageProvider implements StorageProvider {
  private readonly files = new Map<string, MemoryFile>();
  private readonly directories = new Set<string>();

  constructor(seedFiles: readonly MemorySeedFile[] = []) {
    for (const seed of seedFiles) {
      this.seedFile(seed);
    }
  }

  private ensureParents(path: string): void {
    const parents: string[] = [];
    let parent = parentPath(path);
    while (parent) {
      parents.push(parent);
      parent = parentPath(parent);
    }
    for (const directory of parents.reverse()) {
      this.directories.add(directory);
    }
  }

  private seedFile(seed: MemorySeedFile): void {
    const path = normalizePath(seed.path);
    const now = new Date();
    this.ensureParents(path);
    this.files.set(path, {
      bytes:
        typeof seed.content === "string"
          ? encoder.encode(seed.content)
          : new Uint8Array(seed.content),
      birthtime: seed.createdAt ?? now,
      mtime: seed.modifiedAt ?? seed.createdAt ?? now,
    });
  }

  async exists(path: string): Promise<boolean> {
    const normalized = normalizePath(path);
    return this.files.has(normalized) || this.directories.has(normalized);
  }

  async readTextFile(path: string): Promise<string> {
    const file = this.files.get(normalizePath(path));
    if (!file) throw new Error(`File not found: ${path}`);
    return decoder.decode(file.bytes);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await this.writeFile(path, encoder.encode(content));
  }

  async writeFile(path: string, bytes: Uint8Array): Promise<void> {
    const normalized = normalizePath(path);
    if (this.directories.has(normalized)) {
      throw new Error(`Cannot write file over directory: ${path}`);
    }
    const existing = this.files.get(normalized);
    const now = new Date();
    this.ensureParents(normalized);
    this.files.set(normalized, {
      bytes: new Uint8Array(bytes),
      birthtime: existing?.birthtime ?? now,
      mtime: now,
    });
  }

  async mkdir(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (this.files.has(normalized)) {
      throw new Error(`Cannot create directory over file: ${path}`);
    }
    this.ensureParents(normalized);
    this.directories.add(normalized);
  }

  async removeFile(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (!this.files.delete(normalized)) {
      throw new Error(`File not found: ${path}`);
    }
  }

  async removeDir(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (!this.directories.has(normalized)) {
      throw new Error(`Directory not found: ${path}`);
    }
    for (const file of [...this.files.keys()]) {
      if (isWithin(file, normalized)) this.files.delete(file);
    }
    for (const directory of [...this.directories]) {
      if (isWithin(directory, normalized)) this.directories.delete(directory);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const source = normalizePath(oldPath);
    const target = normalizePath(newPath);
    if (await this.exists(target)) {
      throw new Error(`Destination already exists: ${newPath}`);
    }

    const file = this.files.get(source);
    if (file) {
      this.ensureParents(target);
      this.files.set(target, file);
      this.files.delete(source);
      return;
    }

    if (!this.directories.has(source)) {
      throw new Error(`Path not found: ${oldPath}`);
    }
    if (isWithin(target, source)) {
      throw new Error(`Cannot move directory into itself: ${newPath}`);
    }

    this.ensureParents(target);
    const directories = [...this.directories]
      .filter((directory) => isWithin(directory, source))
      .sort((a, b) => a.length - b.length);
    const files = [...this.files.entries()].filter(([path]) =>
      isWithin(path, source)
    );
    for (const directory of directories) {
      this.directories.add(`${target}${directory.slice(source.length)}`);
    }
    for (const [path, value] of files) {
      this.files.set(`${target}${path.slice(source.length)}`, value);
    }
    for (const [path] of files) this.files.delete(path);
    for (const directory of directories.reverse()) {
      this.directories.delete(directory);
    }
  }

  async readDir(path: string): Promise<DirEntry[]> {
    const normalized = normalizePath(path);
    if (!this.directories.has(normalized)) {
      throw new Error(`Directory not found: ${path}`);
    }

    const entries = new Map<string, DirEntry>();
    for (const directory of this.directories) {
      if (parentPath(directory) === normalized) {
        const name = baseName(directory);
        entries.set(name, { name, isDirectory: true, isFile: false });
      }
    }
    for (const file of this.files.keys()) {
      if (parentPath(file) === normalized) {
        const name = baseName(file);
        entries.set(name, { name, isDirectory: false, isFile: true });
      }
    }
    return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async fileStat(path: string): Promise<FileStat | null> {
    const normalized = normalizePath(path);
    const file = this.files.get(normalized);
    if (file) {
      return {
        birthtime: new Date(file.birthtime),
        mtime: new Date(file.mtime),
        size: file.bytes.byteLength,
      };
    }
    if (this.directories.has(normalized)) {
      return { birthtime: null, mtime: null, size: 0 };
    }
    return null;
  }
}
