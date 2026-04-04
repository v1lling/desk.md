import { invoke } from "@tauri-apps/api/core";
import { jsonSchema, tool, type ToolSet } from "ai";
import { z } from "zod/v4";
import { useContextIndexStore } from "@/stores/context-index";
import { loadAIIgnoreEntries, isPathExcludedByAIIgnore } from "@/lib/context-index/aiignore";
import type { AIProviderType } from "@/lib/ai/types";

export interface ApprovalRequest {
  callId: string;
  toolName: string;
  args: unknown;
}

export interface ApprovalCallbacks {
  onToolProposed: (request: ApprovalRequest) => void;
  onToolWaitingApproval: (request: ApprovalRequest) => Promise<boolean>;
  onToolResult: (result: {
    callId: string;
    toolName: string;
    ok: boolean;
    payload: unknown;
  }) => void;
}

interface ToolContext {
  providerType: AIProviderType;
  approval: ApprovalCallbacks;
}

function workspacePath(workspaceId: string, path?: string): string {
  const trimmed = (path || ".").trim();
  if (!trimmed || trimmed === ".") {
    return `workspaces/${workspaceId}`;
  }
  const sanitized = trimmed.replace(/^\/+/, "");
  return `workspaces/${workspaceId}/${sanitized}`;
}

async function runMutationWithApproval(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>,
  executor: () => Promise<unknown>
): Promise<unknown> {
  const callId = crypto.randomUUID();
  const request = { callId, toolName, args };
  ctx.approval.onToolProposed(request);

  const approved = await ctx.approval.onToolWaitingApproval(request);
  if (!approved) {
    const rejection = {
      ok: false,
      error: "rejected",
      message: "Tool call rejected by user approval gate.",
    };
    ctx.approval.onToolResult({ callId, toolName, ok: false, payload: rejection });
    return rejection;
  }

  try {
    const payload = await executor();
    ctx.approval.onToolResult({ callId, toolName, ok: true, payload });
    return payload;
  } catch (error) {
    const payload = {
      ok: false,
      error: "execution_failed",
      message: String(error),
    };
    ctx.approval.onToolResult({ callId, toolName, ok: false, payload });
    return payload;
  }
}

async function runReadTool(
  ctx: ToolContext,
  toolName: string,
  args: Record<string, unknown>,
  executor: () => Promise<unknown>
): Promise<unknown> {
  const callId = crypto.randomUUID();
  ctx.approval.onToolProposed({ callId, toolName, args });
  try {
    const payload = await executor();
    const failed =
      typeof payload === "object" &&
      payload !== null &&
      "ok" in payload &&
      (payload as { ok?: unknown }).ok === false;
    ctx.approval.onToolResult({ callId, toolName, ok: !failed, payload });
    return payload;
  } catch (error) {
    const payload = {
      ok: false,
      error: "execution_failed",
      message: String(error),
    };
    ctx.approval.onToolResult({ callId, toolName, ok: false, payload });
    return payload;
  }
}

export function createAssistantTools(ctx: ToolContext): ToolSet {
  const tools: ToolSet = {
    desk_workspace_info: tool({
      description: "List all workspaces with their names, IDs, and project listings. Call this first to orient yourself.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      execute: async () => {
        return runReadTool(ctx, "desk_workspace_info", {}, async () => {
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
        return runReadTool(ctx, "desk_tree", args as Record<string, unknown>, async () => {
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
        return runReadTool(ctx, "desk_catalog", args as Record<string, unknown>, async () => {
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
        return runReadTool(ctx, "desk_read", args as Record<string, unknown>, async () => {
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
        return runReadTool(ctx, "desk_search", args as Record<string, unknown>, async () => {
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

    desk_create_task: tool({
      description: "Create a task in a project or _unassigned. Use desk_workspace_info first to get workspace and project IDs. Requires approval.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        project_id: z.string().min(1),
        title: z.string().min(1),
        status: z.enum(["backlog", "todo", "doing", "waiting", "done"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        due: z.string().optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runMutationWithApproval(ctx, "desk_create_task", args, async () => invoke("desk_create_task", {
          workspaceId: args.workspace_id,
          projectId: args.project_id,
          title: args.title,
          status: args.status,
          priority: args.priority,
          due: args.due,
          content: args.content,
        }));
      },
    }),

    desk_update_task: tool({
      description: "Update an existing task. Requires approval.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        task_id: z.string().min(1),
        project_id: z.string().optional(),
        title: z.string().optional(),
        status: z.enum(["backlog", "todo", "doing", "waiting", "done"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        due: z.string().nullable().optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runMutationWithApproval(ctx, "desk_update_task", args, async () => invoke("desk_update_task", {
          workspaceId: args.workspace_id,
          taskId: args.task_id,
          projectId: args.project_id,
          title: args.title,
          status: args.status,
          priority: args.priority,
          due: args.due,
          content: args.content,
        }));
      },
    }),

    desk_create_meeting: tool({
      description: "Create a meeting note in a project or _unassigned. Use desk_workspace_info first to get workspace and project IDs. Requires approval.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        project_id: z.string().min(1),
        title: z.string().min(1),
        date: z.string().optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runMutationWithApproval(ctx, "desk_create_meeting", args, async () => invoke("desk_create_meeting", {
          workspaceId: args.workspace_id,
          projectId: args.project_id,
          title: args.title,
          date: args.date,
          content: args.content,
        }));
      },
    }),

    desk_update_meeting: tool({
      description: "Update an existing meeting note. Requires approval.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        meeting_id: z.string().min(1),
        project_id: z.string().optional(),
        title: z.string().optional(),
        date: z.string().optional(),
        attendees: z.array(z.string()).optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runMutationWithApproval(ctx, "desk_update_meeting", args, async () => invoke("desk_update_meeting", {
          workspaceId: args.workspace_id,
          meetingId: args.meeting_id,
          projectId: args.project_id,
          title: args.title,
          date: args.date,
          attendees: args.attendees,
          content: args.content,
        }));
      },
    }),

    desk_create_doc: tool({
      description: "Create a document in a project or at workspace level. Use desk_workspace_info first to get workspace and project IDs. Requires approval.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        project_id: z.string().optional(),
        title: z.string().min(1),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runMutationWithApproval(ctx, "desk_create_doc", args, async () => invoke("desk_create_doc", {
          workspaceId: args.workspace_id,
          projectId: args.project_id,
          title: args.title,
          content: args.content,
        }));
      },
    }),

    desk_update_doc: tool({
      description: "Update an existing document. Requires approval.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        doc_id: z.string().min(1),
        project_id: z.string().optional(),
        title: z.string().optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runMutationWithApproval(ctx, "desk_update_doc", args, async () => invoke("desk_update_doc", {
          workspaceId: args.workspace_id,
          docId: args.doc_id,
          projectId: args.project_id,
          title: args.title,
          content: args.content,
        }));
      },
    }),
  };

  // Provider-native web search: enabled only when explicitly supported.
  if (ctx.providerType === "openai") {
    tools.web_search = tool({
      description: "Search the web for current information or public data not available in the workspace.",
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: async (args) =>
        runReadTool(ctx, "web_search", args as Record<string, unknown>, async () => ({
          ok: false,
          error: "unsupported",
          message: `Native web search is not available in this desktop runtime yet. Query: ${args.query}`,
        })),
    });
  }

  return tools;
}
