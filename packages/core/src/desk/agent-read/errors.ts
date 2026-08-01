export type AgentReadErrorCode =
  | "invalid_argument"
  | "not_found"
  | "ambiguous"
  | "excluded"
  | "unsupported_file"
  | "invalid_cursor"
  | "internal";

export class AgentReadError extends Error {
  constructor(
    readonly code: AgentReadErrorCode,
    message: string,
    readonly candidates?: { id: string; name: string }[],
  ) {
    super(message);
    this.name = "AgentReadError";
  }
}

export function asSafeAgentReadError(error: unknown): AgentReadError {
  if (error instanceof AgentReadError) return error;
  return new AgentReadError("internal", "Desk could not complete this read request");
}
