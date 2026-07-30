/**
 * BrowserProvider — a seeded in-memory filesystem for browser development.
 *
 * Browser builds run the same filesystem-backed domain code as Tauri and the
 * server. The only runtime difference is where the bytes live.
 */
import { createBrowserSeedFiles } from "../browser-seed";
import { InMemoryStorageProvider } from "./memory-provider";

export class BrowserProvider extends InMemoryStorageProvider {
  constructor() {
    super(createBrowserSeedFiles());
  }
}
