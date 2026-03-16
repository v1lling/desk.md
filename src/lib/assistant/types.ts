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
  status: "proposed" | "waiting_approval" | "success" | "error";
  result?: unknown;
}

export interface AssistantConversation {
  id: string;
  title: string;
  mode?: AssistantTurnMode;
  workspaceId: string | null;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
}

export type AssistantEvent =
  | { type: "assistant_text_delta"; text: string }
  | { type: "tool_call_proposed"; callId: string; toolName: string; args: unknown }
  | { type: "tool_call_waiting_approval"; callId: string; toolName: string; args: unknown }
  | { type: "tool_call_result"; callId: string; toolName: string; ok: boolean; result: unknown }
  | { type: "assistant_done"; usage?: AIUsage }
  | { type: "assistant_error"; message: string }
  | { type: "assistant_cancelled" };

export interface AssistantPendingApproval {
  callId: string;
  toolName: string;
  args: unknown;
}

export interface AssistantRunContext {
  workspaceId: string;
  providerType: AIProviderType;
  model: string;
  mode: AssistantTurnMode;
  userInstructions?: string;
  maxSteps: number;
}
