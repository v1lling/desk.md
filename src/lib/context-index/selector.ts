/**
 * Context Index File Selector
 *
 * Uses an AI call to pick the most relevant files from a workspace catalog
 * based on a user query. This is the "Step 1" AI call in the index-based
 * context retrieval strategy.
 */

import type { AIService } from "@/lib/ai/service";
import type { WorkspaceIndex } from "./types";
import { formatIndexForPrompt } from "./builder";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";

export type Relevance = "high" | "medium" | "low";

export interface ScoredSelection {
  path: string;
  relevance: Relevance;
}

/**
 * Select the most relevant files from a workspace index for a given query.
 * Returns scored selections with relevance level per file.
 */
export async function selectFiles(
  query: string,
  index: WorkspaceIndex,
  options: {
    maxFiles: number;
    aiService: AIService;
  }
): Promise<ScoredSelection[]> {
  if (index.entries.length === 0) {
    return [];
  }

  const catalog = formatIndexForPrompt(index);
  const knownPaths = new Set(index.entries.map((e) => e.path));

  const systemPrompt = SYSTEM_PROMPTS.fileSelector(options.maxFiles);
  const message = `Query: ${query}\n\nFile Catalog:\n${catalog}`;

  try {
    const response = await options.aiService.custom(systemPrompt, message);
    const text = response.message.trim();

    // Try JSON.parse first
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed: unknown[] = JSON.parse(jsonMatch[0]);

        // New format: array of objects with path + relevance
        if (parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null && "path" in parsed[0]) {
          return (parsed as Array<{ path: string; relevance?: string }>)
            .filter((item) => typeof item.path === "string" && knownPaths.has(item.path))
            .map((item) => ({
              path: item.path,
              relevance: isValidRelevance(item.relevance) ? item.relevance : "high",
            }))
            .slice(0, options.maxFiles);
        }

        // Legacy fallback: plain string array → default to "high"
        const validPaths = parsed
          .filter((p): p is string => typeof p === "string" && knownPaths.has(p))
          .slice(0, options.maxFiles);
        return validPaths.map((path) => ({ path, relevance: "high" as Relevance }));
      } catch {
        console.warn("[context-index] JSON parse failed, trying text extraction fallback");
      }
    }

    // Fallback: try to extract paths from response text line by line
    const lines = text.split("\n");
    const foundPaths: string[] = [];
    for (const line of lines) {
      const cleaned = line.replace(/^[\s\-*"\d.]+/, "").replace(/[",\s]+$/, "").trim();
      if (knownPaths.has(cleaned)) {
        foundPaths.push(cleaned);
      }
    }
    return foundPaths.slice(0, options.maxFiles).map((path) => ({ path, relevance: "high" }));
  } catch (error) {
    // AI call failed - return empty
    console.warn("[context-index] File selection AI call failed:", error);
    return [];
  }
}

function isValidRelevance(value: unknown): value is Relevance {
  return value === "high" || value === "medium" || value === "low";
}
