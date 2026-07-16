/**
 * Domain-write bus — the ONE trigger for background maintenance.
 *
 * Published from the record-write funnel in `file-operations.ts` (write/update/delete/move),
 * so every path that mutates a record fires here with no per-surface code:
 *   - app UI mutations (stores → domain functions)
 *   - editor body saves (`saveMarkdownBody`)
 *   - RPC writes from web / native-remote clients (server-side domain calls)
 *   - future MCP write tools (they call domain functions → funnel → here)
 *
 * NOT published (v1): binary asset imports, and the project.md / workspace.md entity writes —
 * no subscriber consumes entity events today; add the publish calls when one does. Recursive
 * directory ops (folder rename/move/delete, project/workspace delete) DO publish: they funnel
 * through `moveDirectoryWithContents` / `removeDirectoryWithContents`, which enumerate the
 * contained markdown files and fire one event per record.
 *
 * External, out-of-band file edits never reach this bus. In local mode the Tauri watcher feeds
 * them into the maintenance engine via `notifyExternalChanges`; on the server they are a
 * documented non-goal (no fs watcher).
 *
 * Broadcast semantics: every listener gets every event; a throwing listener is isolated and
 * must never break the write that triggered it.
 */

export type DomainWriteKind = "write" | "update" | "delete" | "move";

export interface DomainWriteEvent {
  kind: DomainWriteKind;
  /** Absolute path of the written/removed file. */
  filePath: string;
  /** Destination path for `move`. */
  targetPath?: string;
}

type Listener = (event: DomainWriteEvent) => void;

const listeners = new Set<Listener>();

export function onDomainWrite(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishDomainWrite(event: DomainWriteEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.warn("[domain-write-bus] Listener failed:", error);
    }
  }
}
