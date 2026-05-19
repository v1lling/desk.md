import type { AIMessageSource, AIProviderType, AIUsage } from "@/lib/ai/types";

export type AssistantRole = "user" | "assistant";
export type AssistantTurnMode = "chat" | "draft-email";

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  timestamp: string;
  sources?: AIMessageSource[];
  toolEvents?: AssistantToolEvent[];
}

export interface AssistantToolEvent {
  id: string;
  toolName: string;
  args: unknown;
  status: "running" | "success" | "error";
  result?: unknown;
}

export interface AssistantConversation {
  id: string;
  title: string;
  mode?: AssistantTurnMode;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
}

export type AssistantEvent =
  | { type: "assistant_text_delta"; text: string }
  | { type: "tool_call_started"; callId: string; toolName: string; args: unknown }
  | { type: "tool_call_result"; callId: string; toolName: string; ok: boolean; result: unknown }
  | { type: "assistant_done"; usage?: AIUsage }
  | { type: "assistant_error"; message: string }
  | { type: "assistant_cancelled" };

export interface AssistantRunContext {
  providerType: AIProviderType;
  model: string;
  mode: AssistantTurnMode;
  userInstructions?: string;
  maxSteps: number;
}
