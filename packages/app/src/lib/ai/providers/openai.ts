import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { AIProvider, AIRequest, AIResponse } from "../types";

export function createOpenAIProvider(apiKey: string, model?: string): AIProvider {
  const openai = createOpenAI({ apiKey });
  const modelId = model || "gpt-5-mini";

  return {
    id: "openai",
    name: "OpenAI",

    async chat(request: AIRequest): Promise<AIResponse> {
      try {
        const { text, usage } = await generateText({
          model: openai(modelId),
          system: request.systemPrompt,
          messages: [{ role: "user", content: request.message }],
        });

        return {
          message: text,
          usage: usage?.inputTokens && usage?.outputTokens ? {
            promptTokens: usage.inputTokens,
            completionTokens: usage.outputTokens,
            totalTokens: usage.inputTokens + usage.outputTokens,
          } : undefined,
        };
      } catch (error) {
        throw new Error(`OpenAI API error: ${error}`);
      }
    },
  };
}

