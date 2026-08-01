import { getStorage } from "../storage";
import { AgentReadError } from "./errors";
import {
  assertPathVisible,
  assertWorkspaceRelativePath,
  codePoints,
  isReadableTextPath,
  looksLikeBinaryContent,
  resolveAgentScope,
  workspaceAbsolutePath,
  workspaceRef,
} from "./shared";
import type { AgentReadQuery, AgentReadResult } from "./types";

export async function runDeskRead(query: AgentReadQuery): Promise<AgentReadResult> {
  const { workspace } = await resolveAgentScope(query.workspace);
  const path = assertWorkspaceRelativePath(query.path);
  if (!isReadableTextPath(path)) {
    throw new AgentReadError(
      "unsupported_file",
      "This file is not a supported text format; use desk_catalog for its metadata",
    );
  }
  await assertPathVisible(workspace.id, path);
  const absolutePath = await workspaceAbsolutePath(workspace.id, path);
  if (!(await getStorage().exists(absolutePath))) {
    throw new AgentReadError("not_found", `File '${path}' was not found in this workspace`);
  }
  let content: string;
  try {
    content = await getStorage().readTextFile(absolutePath);
  } catch {
    throw new AgentReadError("internal", "Desk could not read this source file");
  }
  if (looksLikeBinaryContent(content)) {
    throw new AgentReadError(
      "unsupported_file",
      "This file contains binary data; use desk_catalog for its metadata",
    );
  }
  const points = codePoints(content);
  const offset = Math.max(0, query.offset ?? 0);
  if (!Number.isInteger(offset) || offset > points.length) {
    throw new AgentReadError("invalid_argument", "offset must be an integer within the file");
  }
  const maxChars = Math.min(50_000, Math.max(1, query.max_chars ?? 12_000));
  if (!Number.isInteger(maxChars)) {
    throw new AgentReadError("invalid_argument", "max_chars must be an integer");
  }
  const slice = points.slice(offset, offset + maxChars);
  const nextOffset = offset + slice.length;
  const truncated = nextOffset < points.length;
  return {
    workspace: workspaceRef(workspace),
    path,
    content: slice.join(""),
    offset,
    returned_chars: slice.length,
    total_chars: points.length,
    truncated,
    next_offset: truncated ? nextOffset : undefined,
  };
}
