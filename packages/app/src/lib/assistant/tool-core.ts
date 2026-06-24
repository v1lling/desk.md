import { jsonSchema, tool, type ToolSet } from "ai";
import { z } from "zod/v4";
import { useContextIndexStore } from "@/stores/context-index";
import { loadAIIgnoreEntries, isPathExcludedByAIIgnore } from "@/lib/context-index/aiignore";
import { getDeskService } from "@desk/core";
import { isRemoteMode } from "@/lib/connection";
import { invalidateAfterRemoteWrite } from "@/lib/assistant/remote-write-refresh";
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

/** Build a data-root-relative path under a workspace, sanitizing the input. */
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
    // In remote mode the write ran on the server, so the local file watcher never
    // sees it. Refresh the client's TanStack caches off the returned file path so
    // list / board / tree views reflect the assistant's write. (No-op locally —
    // the watcher already handles it.)
    if (!failed && isRemoteMode()) {
      const path = (payload as { path?: unknown })?.path;
      if (typeof path === "string" && path) invalidateAfterRemoteWrite(path);
    }
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
    // ── Read tools ────────────────────────────────────────────────────────
    desk_workspace_info: tool({
      description: "List all workspaces with their names, IDs, and project listings. Call this first to orient yourself.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", properties: {} }),
      execute: async () => {
        return runTool(ctx, "desk_workspace_info", {}, async () => {
          return getDeskService().deskWorkspaceInfo();
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
          // .aiignore is enforced inside the domain (agent-queries), so the result
          // is already filtered.
          return getDeskService().deskTree(args.workspace_id, args.path);
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
          // .aiignore exclusion is enforced inside the domain (deskReadFile throws
          // for an excluded path).
          return getDeskService().deskReadFile(workspacePath(args.workspace_id, args.path));
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
          // .aiignore-excluded files are skipped inside the domain (deskFullTextSearch).
          return getDeskService().deskFullTextSearch(
            args.query,
            workspacePath(args.workspace_id, args.path)
          );
        });
      },
    }),

    // ── Write tools ───────────────────────────────────────────────────────
    desk_create_task: tool({
      description: "Create a task in a project. Returns the new task's id and file path.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        project_id: z.string().min(1),
        title: z.string().min(1),
        status: z.enum(["todo", "doing", "waiting", "done"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        due: z.string().optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runTool(ctx, "desk_create_task", args as Record<string, unknown>, async () => {
          const task = await getDeskService().createTask({
            workspaceId: args.workspace_id,
            projectId: args.project_id,
            title: args.title,
            priority: args.priority,
            due: args.due,
            content: args.content,
          });
          if (args.status && args.status !== "todo") {
            await getDeskService().updateTask(task.id, { status: args.status }, args.workspace_id, args.project_id);
          }
          return { ok: true, id: task.id, path: task.filePath, message: `Created task "${args.title}"` };
        });
      },
    }),

    desk_update_task: tool({
      description: "Update an existing task's fields. Provide only the fields to change.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        task_id: z.string().min(1),
        project_id: z.string().optional(),
        title: z.string().optional(),
        status: z.enum(["todo", "doing", "waiting", "done"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        due: z.string().optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runTool(ctx, "desk_update_task", args as Record<string, unknown>, async () => {
          const updated = await getDeskService().updateTask(
            args.task_id,
            {
              title: args.title,
              status: args.status,
              priority: args.priority,
              due: args.due,
              content: args.content,
            },
            args.workspace_id,
            args.project_id
          );
          if (!updated) {
            return { ok: false, error: "not_found", message: `Task '${args.task_id}' not found` };
          }
          return { ok: true, id: updated.id, path: updated.filePath, message: `Updated task "${updated.title}"` };
        });
      },
    }),

    desk_create_meeting: tool({
      description: "Create a meeting note in a project. Returns the new meeting's id and file path.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        project_id: z.string().min(1),
        title: z.string().min(1),
        date: z.string().optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runTool(ctx, "desk_create_meeting", args as Record<string, unknown>, async () => {
          const meeting = await getDeskService().createMeeting({
            workspaceId: args.workspace_id,
            projectId: args.project_id,
            title: args.title,
            date: args.date,
            content: args.content,
          });
          return { ok: true, id: meeting.id, path: meeting.filePath, message: `Created meeting "${args.title}"` };
        });
      },
    }),

    desk_update_meeting: tool({
      description: "Update an existing meeting note. Provide only the fields to change.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        meeting_id: z.string().min(1),
        project_id: z.string().optional(),
        title: z.string().optional(),
        date: z.string().optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runTool(ctx, "desk_update_meeting", args as Record<string, unknown>, async () => {
          const updated = await getDeskService().updateMeeting(
            args.meeting_id,
            { title: args.title, date: args.date, content: args.content },
            args.workspace_id,
            args.project_id
          );
          if (!updated) {
            return { ok: false, error: "not_found", message: `Meeting '${args.meeting_id}' not found` };
          }
          return { ok: true, id: updated.id, path: updated.filePath, message: `Updated meeting "${updated.title}"` };
        });
      },
    }),

    desk_create_doc: tool({
      description: "Create a document. Provide project_id for a project doc, or omit it for a workspace-level doc. Set kind to 'ai' for an ai-docs/ document.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        project_id: z.string().optional(),
        title: z.string().min(1),
        content: z.string().optional(),
        kind: z.enum(["human", "ai"]).optional(),
      }),
      execute: async (args) => {
        return runTool(ctx, "desk_create_doc", args as Record<string, unknown>, async () => {
          const doc = args.project_id
            ? await getDeskService().createDoc({
                workspaceId: args.workspace_id,
                projectId: args.project_id,
                title: args.title,
                content: args.content,
                kind: args.kind,
              })
            : await getDeskService().createDocInFolder({
                scope: "workspace",
                workspaceId: args.workspace_id,
                title: args.title,
                content: args.content,
                kind: args.kind,
              });
          return { ok: true, id: doc.id, path: doc.filePath, message: `Created document "${args.title}"` };
        });
      },
    }),

    desk_update_doc: tool({
      description: "Update an existing document's title and/or content.",
      inputSchema: z.object({
        workspace_id: z.string().min(1),
        doc_id: z.string().min(1),
        title: z.string().optional(),
        content: z.string().optional(),
      }),
      execute: async (args) => {
        return runTool(ctx, "desk_update_doc", args as Record<string, unknown>, async () => {
          const doc = await getDeskService().getDoc(args.workspace_id, args.doc_id);
          if (!doc) {
            return { ok: false, error: "not_found", message: `Document '${args.doc_id}' not found` };
          }
          const updated = await getDeskService().updateDoc(doc, { title: args.title, content: args.content });
          if (!updated) {
            return { ok: false, error: "update_failed", message: `Failed to update document '${args.doc_id}'` };
          }
          return { ok: true, id: updated.id, path: updated.filePath, message: `Updated document "${updated.title}"` };
        });
      },
    }),
  };
}
