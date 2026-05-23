import { stepCountIs, streamText } from "ai";
import { getProviderDefinition } from "@/lib/ai/provider-registry";
import { BrowserModeError, getSecret } from "@/lib/ai/secrets";
import type { AIProviderType, AIUsage } from "@/lib/ai/types";
import { buildAssistantSystemPrompt } from "@/lib/ai/prompts";
import { formatError } from "@/lib/utils";
import { createAssistantTools } from "@/lib/assistant/tool-core";
import type { AssistantEvent, AssistantMessage, AssistantTurnMode } from "@/lib/assistant/types";

interface RunAssistantOptions {
  message: string;
  history: AssistantMessage[];
  providerType: AIProviderType;
  model: string;
  mode: AssistantTurnMode;
  maxSteps: number;
  customInstructions?: string;
  perAssistantInstructions?: string;
  signal?: AbortSignal;
  onEvent: (event: AssistantEvent) => void;
}

function toModelMessages(history: AssistantMessage[], message: string) {
  // A failed assistant turn is kept in the conversation (with `error` set) so it can
  // render as an inline error bubble, but its `content` is empty. Sending an empty
  // assistant message to the model breaks the next turn (the Anthropic API rejects
  // empty text blocks), so substitute a placeholder — this keeps role alternation
  // intact while telling the model the prior turn produced nothing.
  const messages = history.map((item) => ({
    role: item.role,
    content:
      item.role === "assistant" && !item.content.trim()
        ? "(The assistant's previous response failed and was not generated.)"
        : item.content,
  }));
  messages.push({ role: "user" as const, content: message });
  return messages;
}

function mapUsage(usage: { inputTokens?: number; outputTokens?: number } | undefined): AIUsage | undefined {
  if (!usage?.inputTokens && !usage?.outputTokens) return undefined;
  const promptTokens = usage.inputTokens ?? 0;
  const completionTokens = usage.outputTokens ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

export async function runAssistantTurn(options: RunAssistantOptions): Promise<{ text: string; usage?: AIUsage }> {
  const providerDef = getProviderDefinition(options.providerType);
  let apiKey: string | null;
  try {
    apiKey = await getSecret(providerDef.keyRef);
  } catch (error) {
    if (error instanceof BrowserModeError) {
      throw new Error("AI is unavailable in browser mode. Run `npm run tauri:dev` (or the built app) to use the assistant.");
    }
    throw new Error(`Couldn't read the OS keychain: ${String(error)}`);
  }

  if (!apiKey) {
    throw new Error(`${providerDef.label} API key is not configured.`);
  }

  const model = providerDef.createModel(apiKey, options.model);

  const tools = createAssistantTools({
    callbacks: {
      onToolStarted: (event) => {
        options.onEvent({
          type: "tool_call_started",
          callId: event.callId,
          toolName: event.toolName,
          args: event.args,
        });
      },
      onToolResult: (result) => {
        options.onEvent({
          type: "tool_call_result",
          callId: result.callId,
          toolName: result.toolName,
          ok: result.ok,
          result: result.payload,
        });
      },
    },
  });

  const result = streamText({
    model,
    system: buildAssistantSystemPrompt(
      options.mode,
      options.customInstructions,
      options.perAssistantInstructions
    ),
    messages: toModelMessages(options.history, options.message),
    tools,
    stopWhen: stepCountIs(options.maxSteps),
    abortSignal: options.signal,
    onError: ({ error }) => {
      console.error("[assistant] streamText error:", error);
      options.onEvent({ type: "assistant_error", message: formatError(error) });
    },
  });

  let finalText = "";

  try {
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        finalText += part.text;
        options.onEvent({ type: "assistant_text_delta", text: part.text });
      }

      if (part.type === "error") {
        console.error("[assistant] stream error part:", part.error);
        options.onEvent({ type: "assistant_error", message: formatError(part.error) });
      }
    }
  } catch (error) {
    if (options.signal?.aborted) {
      options.onEvent({ type: "assistant_cancelled" });
      throw error;
    }
    console.error("[assistant] turn failed:", error);
    options.onEvent({ type: "assistant_error", message: formatError(error) });
    throw error;
  }

  const usage = mapUsage(await result.totalUsage);
  options.onEvent({ type: "assistant_done", usage });

  return { text: finalText, usage };
}
