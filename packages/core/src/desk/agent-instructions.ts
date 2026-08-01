import { getSetting } from "./settings";
import { codePoints } from "./agent-read/shared";

export const AGENT_INSTRUCTIONS_SETTING_KEY = "agent-instructions";
export const MAX_GLOBAL_AGENT_INSTRUCTION_CHARS = 8_000;

export interface AgentInstructionsSetting {
  global: string;
}

/** Normalize current and legacy (`perWorkspace`) settings without carrying the old field forward. */
export function normalizeAgentInstructionsSetting(value: unknown): AgentInstructionsSetting {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { global: "" };
  const global = (value as { global?: unknown }).global;
  return {
    global: typeof global === "string"
      ? codePoints(global).slice(0, MAX_GLOBAL_AGENT_INSTRUCTION_CHARS).join("")
      : "",
  };
}

export async function readGlobalAgentInstructions(): Promise<{
  content?: string;
  total_chars: number;
  truncated: boolean;
}> {
  let parsed: unknown;
  try {
    const raw = await getSetting(AGENT_INSTRUCTIONS_SETTING_KEY);
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    parsed = undefined;
  }
  const value = normalizeAgentInstructionsSetting(parsed).global.trim();
  const points = codePoints(value);
  const truncated = points.length > MAX_GLOBAL_AGENT_INSTRUCTION_CHARS;
  const content = points.slice(0, MAX_GLOBAL_AGENT_INSTRUCTION_CHARS).join("");
  return { content: content || undefined, total_chars: points.length, truncated };
}
