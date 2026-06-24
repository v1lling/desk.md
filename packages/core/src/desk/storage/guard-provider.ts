/**
 * GuardStorageProvider — the StorageProvider installed when the domain runs on a
 * server (native-remote or hosted-web). Every primitive throws.
 *
 * Rationale: in remote mode all domain data must travel through getDeskService()
 * (the RPC client). The local disk is the *wrong* disk. Rather than leave a working
 * local provider in place — where a stray getStorage() call silently reads/writes
 * the wrong machine — we install this guard so such a call fails loudly and points
 * the developer at the seam they should be using. It is NOT a remote proxy: we
 * deliberately do not re-remote SEAM 1 (that reintroduces per-read latency).
 */
import type { DirEntry, FileStat, StorageProvider } from "./provider";

const MESSAGE =
  "getStorage() is unavailable in remote mode — route this through getDeskService() instead. " +
  "The local filesystem is not the source of truth when the domain runs on a server.";

function blocked(): never {
  throw new Error(MESSAGE);
}

export class GuardStorageProvider implements StorageProvider {
  readonly isMock = false;

  exists(_path: string): Promise<boolean> {
    return blocked();
  }
  readTextFile(_path: string): Promise<string> {
    return blocked();
  }
  writeTextFile(_path: string, _content: string): Promise<void> {
    return blocked();
  }
  writeFile(_path: string, _bytes: Uint8Array): Promise<void> {
    return blocked();
  }
  mkdir(_path: string): Promise<void> {
    return blocked();
  }
  removeFile(_path: string): Promise<void> {
    return blocked();
  }
  removeDir(_path: string): Promise<void> {
    return blocked();
  }
  rename(_oldPath: string, _newPath: string): Promise<void> {
    return blocked();
  }
  readDir(_path: string): Promise<DirEntry[]> {
    return blocked();
  }
  fileStat(_path: string): Promise<FileStat | null> {
    return blocked();
  }
}
