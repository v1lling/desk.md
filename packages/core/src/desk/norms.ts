/**
 * How a desk space works, stated once.
 *
 * This is the single source of the conventions every external agent needs. It is rendered
 * into three front doors, which must never drift apart:
 *   - the generated CLAUDE.md / AGENTS.md / GEMINI.md (local mode, `lib/context-index/agent-context.ts`)
 *   - WORKSPACE_CONTEXT.md's legend (local mode, `lib/context-index/artifacts.ts`)
 *   - the MCP server's `instructions` (hosted mode, `packages/server/src/mcp.ts`)
 *
 * The third one is why this lives in core: the generated markdown files are only written
 * on a real local disk, so before this constant existed a hosted MCP agent received the
 * taxonomy with none of the norms.
 *
 * Nothing else should re-teach these conventions. Tool descriptions describe the tool;
 * this teaches the space. (Agent-facing prose is deliberately out of scope for i18n.)
 */
export const DESK_SPACE_NORMS = `## How this space works

Desk is a markdown work-management space: workspaces, projects, tasks, docs, meetings — plain \`.md\` files with YAML frontmatter. Two kinds of material live here, split by lifecycle: **records** (\`docs/\`, \`tasks/\`, \`meetings/\`) are dated, accumulate, and are never rewritten; **context** (\`context/\`, at the workspace root and each project root) is the map — evergreen, small, kept current. **Read \`context/\` first.**

When your understanding changes, *update* the relevant context file rather than piling on new ones. A genuinely distinct topic can get its own context file; a pile is no longer a map. Anything dated or append-only — research with sources, a decision record, session notes — is a record and belongs in \`docs/\`.

A project's \`context/\` holds a \`*-brief.md\` — the user's own statement of what the project is; treat it as read-only — and may hold a \`*-state.md\` ("Current state"), which Desk maintains automatically. Don't edit the state file; it is overwritten on refresh.

Stamp \`author: ai\` in the frontmatter of any file you create. Absence means the user wrote it; never write \`author: human\`.

Tasks and meetings are committed work items — surface candidates to the user rather than creating them.

\`.aiignore\` at a workspace root lists paths the user flagged as sensitive (gitignore syntax). Honor it.`;
