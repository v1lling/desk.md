/**
 * Agent-context-writer seam.
 *
 * Creating/updating a workspace regenerates the external-agent files
 * (CLAUDE.md / AGENTS.md / GEMINI.md). That generation reads UI stores
 * (context settings, AI instructions), so it can't live in core. The domain
 * calls this injectable writer; the app wires it to the context-index module,
 * the server leaves the no-op default (server-side generation is a later step).
 *
 * Mirrors the storage/service registries (the set/get registry pattern).
 */
import type { Project, Workspace } from "../types";

export interface AgentContextWriter {
  writePerWorkspace(workspaceId: string, workspace: Workspace, projects: Project[]): Promise<void>;
  writeTopLevel(workspaces: Workspace[]): Promise<void>;
}

const NOOP: AgentContextWriter = {
  async writePerWorkspace() {},
  async writeTopLevel() {},
};

let writer: AgentContextWriter = NOOP;

export function setAgentContextWriter(w: AgentContextWriter): void {
  writer = w;
}

export function getAgentContextWriter(): AgentContextWriter {
  return writer;
}
