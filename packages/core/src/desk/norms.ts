/**
 * How a desk space works, stated once.
 *
 * This is the single source of the conventions every external agent needs. It is rendered
 * into both agent front doors, which must never drift apart:
 *   - the generated CLAUDE.md / AGENTS.md / GEMINI.md (local mode, `lib/smart-index/agent-files.ts`)
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

Desk is a markdown work-management space: workspaces, projects, tasks, docs, and meetings — plain \`.md\` files with YAML frontmatter.

Each workspace's \`workspace.md\` body and each project's \`project.md\` body is its **Overview**: the user's own orientation, intent, and boundaries. Read the relevant Overview first and treat it as user-owned — don't rewrite it.

Documents live in \`docs/\`. Users choose whatever folder structure fits their work; do not infer lifecycle or authorship semantics from folder names. Tasks live in \`tasks/\` and meetings in \`meetings/\`.

Stamp \`author: ai\` in the frontmatter of any document, task, or meeting you create. Absence means the user wrote it; never write \`author: human\`.

Tasks and meetings are committed work items — surface candidates to the user rather than creating them.

\`.aiignore\` at a workspace root lists paths the user flagged as sensitive (gitignore syntax). Honor it.`;
