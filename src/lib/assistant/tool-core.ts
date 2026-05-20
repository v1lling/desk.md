import { invoke } from "@tauri-apps/api/core";
import { jsonSchema, tool, type ToolSet } from "ai";
import { z } from "zod/v4";
import { useContextIndexStore } from "@/stores/context-index";
import { loadAIIgnoreEntries, isPathExcludedByAIIgnore } from "@/lib/context-index/aiignore";
import { formatError } from "@/lib/utils";

export interface ToolCallEvent {
  callId: string;
  toolName: string;
  args: unknown;
}

export interface ToolCallbacks {
  onToolStarted: (event: ToolCallEvent) => void;
  onToolResult: (result: {
    callId: string;
    toolName: string;
    ok: boolean;
    payload: unknown;
  }) => void;
}

interface ToolContext {
  callbacks: ToolCallbacks;
}

function workspacePath(workspaceId: string, path?: string): string {
  const trimmed = (path || ".").trim();
  if (!trimmed || trimmed === ".") {
    return `workspaces/${workspaceId}`;
  }
  const sanitized = trimmed.replace(/^\/+/, "");
  return `workspaces/${workspaceId}/${sanitized}`;
}

async function runTool(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>,
  executor: () => Promise<unknown>
): Promise<unknown> {
  const callId = crypto.randomUUID();
  ctx.callbacks.onToolStarted({ callId, toolName, args });
  try {
    const payload = await executor();
    const failed =
      typeof payload === "object" &&
      payload !== null &&
      "ok" in payload &&
      (payload as { ok?: unknown }).ok === false;
    ctx.callbacks.onToolResult({ callId, toolName, ok: !failed, payload });
    return payload;
  } catch (error) {
    const payload = {
      ok: false,
      error: "execution_failed",
      message: formatError(error),
    };
    ctx.callbacks.onToolResult({ callId, toolName, ok: false, payload });
    return payload;
  }
}

export function createAssistantTools(ctx: ToolContext): ToolSet {
  return {
    desk_workspace_info: tool({
      description: "List all workspaces with their names, IDs, and project listings. Call this first to orient yourself.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      execute: async () => {
        return runTool(ctx, "desk_workspace_info", {}, async () => {
          return invoke("desk_workspace_info", {});
        });
      },
    }),

    desk_tree: tool({
      description:
        "Get a workspace's file tree. Returns ALL files and directories as a flat list with workspace-relative paths (usable with desk_read). Also returns project ID-to-name mappings. Without a path argument this returns the complete tree — if truncated is false, you have everything; do NOT re-call for subdirectories. Only use path to drill into a subdirectory when the full tree was truncated.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        path: z.string().optional(),
      }),
      execute: async (args) => {
        return runTool(ctx, "desk_tree", args as Record<string, unknown>, async () => {
          return invoke("desk_tree", {
            workspaceId: args.workspace_id,
            path: args.path,
          });
        });
      },
    }),

    desk_catalog: tool({
      description:
        "Get the AI-curated workspace catalog with summaries. Returns path, type, title, summary, date, and metadata for each indexed file — sorted newest-first. Use this to understand file contents and decide what to desk_read. May be stale if index hasn't been rebuilt recently. For recency or structural queries, prefer desk_tree.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
      }),
      execute: async (args) => {
        return runTool(ctx, "desk_catalog", args as Record<string, unknown>, async () => {
          const index = useContextIndexStore.getState().getIndex(args.workspace_id);
          if (!index || index.entries.length === 0) {
            return {
              workspace_id: args.workspace_id,
              entries: [],
              total: 0,
              message: "No index built yet. Use desk_tree for file listing.",
            };
          }

          const aiignoreEntries = await loadAIIgnoreEntries(args.workspace_id);

          const sorted = [...index.entries]
            .filter((e) => {
              if (aiignoreEntries.length > 0 && isPathExcludedByAIIgnore(e.path, aiignoreEntries)) {
                return false;
              }
              return true;
            })
            .sort((a, b) => {
              const dateA = a.date ?? a.created ?? "";
              const dateB = b.date ?? b.created ?? "";
              return dateB.localeCompare(dateA);
            });

          return {
            workspace_id: args.workspace_id,
            built_at: index.builtAt,
            total: sorted.length,
            entries: sorted.map((e) => ({
              path: e.path,
              type: e.type,
              title: e.title,
              summary: e.summary,
              date: e.date ?? e.created?.split("T")[0],
              ...(e.status && { status: e.status }),
              ...(e.priority && { priority: e.priority }),
              ...(e.projectName && { project: e.projectName }),
            })),
          };
        });
      },
    }),

    desk_read: tool({
      description: "Read the full content of a workspace file. Use after desk_tree or desk_catalog to read candidate files before making factual claims.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        path: z.string().min(1),
      }),
      execute: async (args) => {
        return runTool(ctx, "desk_read", args as Record<string, unknown>, async () => {
          const aiignoreEntries = await loadAIIgnoreEntries(args.workspace_id);
          if (isPathExcludedByAIIgnore(args.path, aiignoreEntries)) {
            return { ok: false, error: "excluded", message: "This file is excluded from AI access." };
          }
          const path = workspacePath(args.workspace_id, args.path);
          return invoke("desk_read", { path });
        });
      },
    }),

    desk_search: tool({
      description: "Full-text search across workspace files. Use for specific text, quotes, or keywords.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        query: z.string().min(1),
        path: z.string().optional(),
      }),
      execute: async (args) => {
        return runTool(ctx, "desk_search", args as Record<string, unknown>, async () => {
          const path = workspacePath(args.workspace_id, args.path);
          const result = await invoke("desk_search", { query: args.query, path }) as {
            matches?: Array<{ path: string }>;
          };
          const aiignoreEntries = await loadAIIgnoreEntries(args.workspace_id);
          if (aiignoreEntries.length > 0 && Array.isArray(result.matches)) {
            const wsPrefix = `workspaces/${args.workspace_id}/`;
            result.matches = result.matches.filter(
              (m) => !isPathExcludedByAIIgnore(
                m.path.startsWith(wsPrefix) ? m.path.slice(wsPrefix.length) : m.path,
                aiignoreEntries
              )
            );
          }
          return result;
        });
      },
    }),
  };
}
