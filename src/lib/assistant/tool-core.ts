import { invoke } from "@tauri-apps/api/core";
import { jsonSchema, tool, type ToolSet } from "ai";
import { z } from "zod/v4";
import { createAIService } from "@/lib/ai/service";
import { selectFiles } from "@/lib/context-index/selector";
import { useContextIndexStore } from "@/stores/context-index";
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

function relevanceToScore(relevance: "high" | "medium" | "low"): number {
  switch (relevance) {
    case "high":
      return 100;
    case "medium":
      return 70;
    case "low":
      return 40;
  }
}

async function runCatalogSelectorSearch(
  ctx: ToolContext,
  query: string,
  limit: number
): Promise<{
  workspace_id: string;
  source: string;
  query: string;
  results: Array<{ path: string; title: string; summary: string; score: number }>;
} | null> {
  const index = useContextIndexStore.getState().getIndex(ctx.workspaceId);
  if (!index || index.entries.length === 0) {
    return null;
  }

  try {
    const aiService = createAIService({ providerType: ctx.providerType });
    const selections = await selectFiles(query, index, {
      maxFiles: limit,
      aiService,
    });

    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));
    const results = selections
      .map((selection) => {
        const entry = byPath.get(selection.path);
        if (!entry) return null;
        return {
          path: entry.path,
          title: entry.title || entry.path,
          summary: entry.summary || "",
          score: relevanceToScore(selection.relevance),
        };
      })
      .filter((result): result is { path: string; title: string; summary: string; score: number } => !!result)
      .slice(0, limit);

    return {
      workspace_id: ctx.workspaceId,
      source: "context_index_ai_selector",
      query,
      results,
    };
  } catch (error) {
    console.warn("[assistant] Catalog selector failed, falling back to desk_index_search:", error);
    return null;
  }
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
    desk_list: tool({
      description: "List files and folders inside the current workspace.",
      inputSchema: jsonSchema<{ path?: string }>({
        type: "object",
        properties: {
          path: { type: "string" },
        },
      }),
      execute: async (args) => {
        return runReadTool(ctx, "desk_list", (args as { path?: string }) as Record<string, unknown>, async () => {
          const path = workspacePath(ctx.workspaceId, (args as { path?: string }).path);
          return invoke("desk_list", { path });
        });
      },
    }),

    desk_read: tool({
      description: "Read a text file inside the current workspace.",
      inputSchema: z.object({
        path: z.string().min(1),
      }),
      execute: async (args) => {
        return runReadTool(ctx, "desk_read", args as Record<string, unknown>, async () => {
          const path = workspacePath(ctx.workspaceId, args.path);
          return invoke("desk_read", { path });
        });
      },
    }),

    desk_search: tool({
      description: "Search text inside files of the current workspace.",
      inputSchema: z.object({
        query: z.string().min(1),
        path: z.string().optional(),
      }),
      execute: async (args) => {
        return runReadTool(ctx, "desk_search", args as Record<string, unknown>, async () => {
          const path = workspacePath(ctx.workspaceId, args.path);
          return invoke("desk_search", { query: args.query, path });
        });
      },
    }),

    desk_index_search: tool({
      description: "Search the workspace context catalog for relevant files.",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().positive().max(20).optional(),
      }),
      execute: async (args) => {
        return runReadTool(ctx, "desk_index_search", args as Record<string, unknown>, async () => {
          const query = args.query.trim();
          const limit = args.limit ?? 8;

          // Assistant-first path: LLM selector over the local catalog (legacy behavior parity).
          const selected = await runCatalogSelectorSearch(ctx, query, limit);
          if (selected) return selected;

          // Fallback path: Rust-side lexical search over WORKSPACE_CONTEXT.
          return invoke("desk_index_search", {
            query,
            workspaceId: ctx.workspaceId,
            limit,
          });
        });
      },
    }),

    desk_workspace_info: tool({
      description: "Get metadata for the active workspace and projects.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      execute: async () => {
        return runReadTool(ctx, "desk_workspace_info", {}, async () => {
          return invoke("desk_workspace_info", { workspaceId: ctx.workspaceId });
        });
      },
    }),

    desk_create_task: tool({
      description: "Create a task in a project (or _unassigned). Requires approval.",
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
      description: "Create a meeting note in a project (or _unassigned). Requires approval.",
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
      description: "Create a document in project/workspace scope. Requires approval.",
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
      description: "Web search (provider support dependent).",
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
