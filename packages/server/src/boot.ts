/**
 * Server boot wiring.
 *
 * Injects the server's host implementations into the @desk/core seams, then the
 * domain layer runs in-process on Node exactly as it does in the Tauri webview:
 *   - storage         → NodeFsProvider (the server's data volume)
 *   - data root        → DESK_DATA_ROOT env var (already absolute; no ~ expand)
 *   - editor notifier  → no-op default (no editor tabs on a server)
 *   - agent-context    → no-op default (generated agent files are a local-disk feature)
 *   - AI key           → environment (ANTHROPIC_API_KEY / OPENAI_API_KEY)
 */
import { statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { setDataRootResolver, setStorage, setAIKeyResolver } from "@desk/core";
import { NodeFsProvider } from "./node-fs-provider";

export function resolveDataRoot(): string {
  const root = process.env.DESK_DATA_ROOT ?? "/data";
  if (!isAbsolute(root)) {
    throw new Error(`DESK_DATA_ROOT must be an absolute path; got: ${root}`);
  }
  let isDir = false;
  try {
    isDir = statSync(root).isDirectory();
  } catch {
    throw new Error(`DESK_DATA_ROOT does not exist: ${root}`);
  }
  if (!isDir) {
    throw new Error(`DESK_DATA_ROOT is not a directory: ${root}`);
  }
  return root;
}

export function boot(): void {
  const root = resolveDataRoot();
  setStorage(new NodeFsProvider(root));
  // isTauri() is false on Node, so getDeskPath() returns this verbatim (no
  // tilde expansion). It must therefore be an absolute path to the data dir.
  setDataRootResolver(async () => root);

  // AI key seam: on the server, provider keys come from the environment. Setting one is the
  // operator's consent to server-side AI maintenance (see deploy/.env.example).
  // Explicit map, no fallback branch: an unknown keyRef (a future provider) must resolve to
  // null — never silently authenticate against another provider's key.
  const keyEnv: Record<string, string | undefined> = {
    "ai.anthropic": process.env.ANTHROPIC_API_KEY,
    "ai.openai": process.env.OPENAI_API_KEY,
  };
  setAIKeyResolver(async (ref) => keyEnv[ref]?.trim() || null);
}
