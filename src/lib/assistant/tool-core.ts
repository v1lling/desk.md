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
  workspaceId: string;
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
    desk_tree: tool({
      description:
        "Get the workspace file tree. Returns ALL files and directories as a flat list with workspace-relative paths (usable with desk_read). Also returns project ID-to-name mappings. Without a path argument this returns the complete tree — if truncated is false, you have everything; do NOT re-call for subdirectories. Only use path to drill into a subdirectory when the full tree was truncated.",
      inputSchema: jsonSchema<{ path?: string }>({
        type: "object",
        properties: {
          path: { type: "string", description: "Optional subdirectory to scope the tree to (workspace-relative). Omit for full workspace." },
        },
      }),
      execute: async (args) => {
        return runReadTool(ctx, "desk_tree", (args as { path?: string }) as Record<string, unknown>, async () => {
          return invoke("desk_tree", {
            workspaceId: ctx.workspaceId,
            path: (args as { path?: string }).path,
          });
        });
      },
    }),

    desk_catalog: tool({
      description:
        "Get the AI-curated workspace catalog with summaries. Returns path, type, title, summary, date, and metadata for each indexed file — sorted newest-first. Use this to understand file contents and decide what to desk_read. May be stale if index hasn't been rebuilt recently. For recency or structural queries, prefer desk_tree.",
      inputSchema: jsonSchema<Record<string, never>>({
        type: "object",
        properties: {},
      }),
      execute: async () => {
        return runReadTool(ctx, "desk_catalog", {}, async () => {
          const index = useContextIndexStore.getState().getIndex(ctx.workspaceId);
          if (!index || index.entries.length === 0) {
            return {
              workspace_id: ctx.workspaceId,
              entries: [],
              total: 0,
              message: "No index built yet. Use desk_tree for file listing.",
            };
          }

          const aiignoreEntries = await loadAIIgnoreEntries(ctx.workspaceId);

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
            workspace_id: ctx.workspaceId,
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
        path: z.string().min(1),
      }),
      execute: async (args) => {
        return runReadTool(ctx, "desk_read", args as Record<string, unknown>, async () => {
          const aiignoreEntries = await loadAIIgnoreEntries(ctx.workspaceId);
          if (isPathExcludedByAIIgnore(args.path, aiignoreEntries)) {
            return { ok: false, error: "excluded", message: "This file is excluded from AI access." };
          }
          const path = workspacePath(ctx.workspaceId, args.path);
          return invoke("desk_read", { path });
        });
      },
    }),

    desk_search: tool({
      description: "Full-text search across workspace files. Use for specific text, quotes, or keywords — not for workspace/client names that are already the current workspace scope.",
      inputSchema: z.object({
        query: z.string().min(1),
        path: z.string().optional(),
      }),
      execute: async (args) => {
        return runReadTool(ctx, "desk_search", args as Record<string, unknown>, async () => {
          const path = workspacePath(ctx.workspaceId, args.path);
          const result = await invoke("desk_search", { query: args.query, path }) as {
            matches?: Array<{ path: string }>;
          };
          const aiignoreEntries = await loadAIIgnoreEntries(ctx.workspaceId);
          if (aiignoreEntries.length > 0 && Array.isArray(result.matches)) {
            const wsPrefix = `workspaces/${ctx.workspaceId}/`;
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

    desk_workspace_info: tool({
      description: "Get workspace name, ID, and all project names with their IDs. Call this first when you need project IDs for creating tasks, meetings, or docs.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      execute: async () => {
        return runReadTool(ctx, "desk_workspace_info", {}, async () => {
          return invoke("desk_workspace_info", { workspaceId: ctx.workspaceId });
        });
      },
    }),

    desk_create_task: tool({
      description: "Create a task in a project or _unassigned. Use desk_workspace_info first to get the project ID. Requires approval.",
      inputSchema: z.object({
        project_id: z.string().min(1),
        title: z.string().min(1),
        status: z.enum(["backlog", "todo", "doing", "waiting", "done"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        due: z.string().optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runMutationWithApproval(ctx, "desk_create_task", args, async () => invoke("desk_create_task", {
          workspaceId: ctx.workspaceId,
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
          workspaceId: ctx.workspaceId,
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
      description: "Create a meeting note in a project or _unassigned. Use desk_workspace_info first to get the project ID. Requires approval.",
      inputSchema: z.object({
        project_id: z.string().min(1),
        title: z.string().min(1),
        date: z.string().optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runMutationWithApproval(ctx, "desk_create_meeting", args, async () => invoke("desk_create_meeting", {
          workspaceId: ctx.workspaceId,
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
        meeting_id: z.string().min(1),
        project_id: z.string().optional(),
        title: z.string().optional(),
        date: z.string().optional(),
        attendees: z.array(z.string()).optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runMutationWithApproval(ctx, "desk_update_meeting", args, async () => invoke("desk_update_meeting", {
          workspaceId: ctx.workspaceId,
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
      description: "Create a document in a project or at workspace level. Use desk_workspace_info first to get the project ID. Requires approval.",
      inputSchema: z.object({
        project_id: z.string().optional(),
        title: z.string().min(1),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runMutationWithApproval(ctx, "desk_create_doc", args, async () => invoke("desk_create_doc", {
          workspaceId: ctx.workspaceId,
          projectId: args.project_id,
          title: args.title,
          content: args.content,
        }));
      },
    }),

    desk_update_doc: tool({
      description: "Update an existing document. Requires approval.",
      inputSchema: z.object({
        doc_id: z.string().min(1),
        project_id: z.string().optional(),
        title: z.string().optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runMutationWithApproval(ctx, "desk_update_doc", args, async () => invoke("desk_update_doc", {
          workspaceId: ctx.workspaceId,
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
