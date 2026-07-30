/**
 * Host-facing @desk/core surface.
 *
 * Applications and servers use this entry point to wire runtime ownership:
 * storage, remote services, UI notifications, generated agent files, and AI
 * secrets. Feature code should use the public `@desk/core` domain API instead.
 */
export {
  getStorage,
  setStorage,
  resetStorage,
  GuardStorageProvider,
  InMemoryStorageProvider,
} from "./desk/storage";
export type {
  DirEntry,
  FileStat,
  MemorySeedFile,
  StorageProvider,
} from "./desk/storage";

export { setDeskService, resetDeskService } from "./desk/service";
export { setDataRootResolver, resetDataRootResolver } from "./desk/data-root";
export {
  setEditorNotifier,
  resetEditorNotifier,
} from "./desk/editor-notifier";
export type { EditorNotifier } from "./desk/editor-notifier";
export {
  setAgentFileWriter,
  resetAgentFileWriter,
} from "./desk/agent-file-writer";
export type { AgentFileWriter } from "./desk/agent-file-writer";
export {
  setAIKeyResolver,
  resetAIKeyResolver,
} from "./desk/ai/key-resolver";
export type {
  AIKeyRef,
  AIKeyResolver,
} from "./desk/ai/key-resolver";
export { resetDeskRuntime } from "./desk/runtime";
