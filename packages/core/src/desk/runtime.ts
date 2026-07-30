/**
 * Dispose global domain state between test/application runtimes.
 *
 * The production app wires these registries once. Tests often replace storage
 * and host seams repeatedly, so they need one supported reset instead of
 * knowing every singleton that happens to exist.
 */
import { resetAgentFileWriter } from "./agent-file-writer";
import { resetAIKeyResolver } from "./ai/key-resolver";
import { resetDataRootResolver } from "./data-root";
import { resetDomainWriteListeners } from "./domain-write-bus";
import { resetEditorEventSubscribers } from "./editor-event-bus";
import { resetEditorNotifier } from "./editor-notifier";
import { resetContentCache, resetFileTreeService } from "./file-cache";
import { resetMaintenanceEngine } from "./maintenance";
import { resetSearchIndex } from "./search-index";
import { resetDeskService } from "./service";
import { resetStorage } from "./storage";
import { clearHomeWorkspaceCache } from "./workspaces";

export function resetDeskRuntime(): void {
  resetMaintenanceEngine();
  resetDomainWriteListeners();
  resetEditorEventSubscribers();
  resetFileTreeService();
  resetContentCache();
  resetSearchIndex();
  clearHomeWorkspaceCache();
  resetDeskService();
  resetStorage();
  resetDataRootResolver();
  resetEditorNotifier();
  resetAgentFileWriter();
  resetAIKeyResolver();
}
