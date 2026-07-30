/**
 * Agent-file-writer seam.
 *
 * Creating/updating a workspace regenerates the external-agent files
 * (CLAUDE.md / AGENTS.md / GEMINI.md). That generation reads UI stores
 * (agent settings and instructions), so it can't live in core. The domain
 * calls this injectable writer; the app wires it to the Smart Index module,
 * the server leaves the no-op default (server-side generation is a later step).
 *
 * Mirrors the storage/service registries (the set/get registry pattern).
 */
import type { Project, Workspace } from "../types";

export interface AgentFileWriter {
  writePerWorkspace(workspaceId: string, workspace: Workspace, projects: Project[]): Promise<void>;
  writeTopLevel(workspaces: Workspace[]): Promise<void>;
}

const NOOP: AgentFileWriter = {
  async writePerWorkspace() {},
  async writeTopLevel() {},
};

let writer: AgentFileWriter = NOOP;

export function setAgentFileWriter(w: AgentFileWriter): void {
  writer = w;
}

export function resetAgentFileWriter(): void {
  writer = NOOP;
}

export function getAgentFileWriter(): AgentFileWriter {
  return writer;
}
