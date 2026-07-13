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
 * Agent-facing prose is deliberately out of scope for i18n (see CLAUDE.md), so this is a
 * plain English constant. It is pure data — no I/O — so it does not violate core's purity.
 */
export const DESK_SPACE_NORMS = `## How this space works

Desk is a markdown work-management space: workspaces, projects, tasks, docs, meetings, all
plain \`.md\` files with YAML frontmatter. You are meant to read across it. Two kinds of
written material live here, and the difference is **lifecycle, not authorship** — the user
and AI both write both kinds.

**Records** — \`docs/\`, \`tasks/\`, \`meetings/\`. Dated. They accumulate and are never
rewritten. A meeting note from March stays a March meeting note; research "as of May" stays
true of May. Because a record only ever claimed to be true of its date, it cannot go stale,
and it is fine for records to pile up indefinitely.

**Context** — \`context/\`, at the workspace and project root. The map: what this is, which
systems it touches, what was decided, where things stand. Evergreen, deliberately small, and
kept current. This is the only layer that can go stale, so it is the only one that gets
maintained.

**Read \`context/\` first.** It is the fastest way to orient yourself, and it holds the intent
and background that cannot be reconstructed from the records alone.

**When your understanding of the space changes** — a decision lands, an architecture shifts,
a system is renamed — *update* \`context/\` rather than appending a new file to it. Context
grows by being rewritten, not by accreting. If \`context/\` starts to look like a pile, it has
stopped being a map.

**Anything dated or append-only is a record.** Research with sources, a decision record, notes
from a session, a draft: these belong in \`docs/\` (or \`tasks/\` / \`meetings/\`), not in
\`context/\`. Their conclusions get distilled *into* context; the documents themselves stay put.

**Stamp \`author: ai\` in the frontmatter of any file you create.** The user filters on it to
tell your output from their own. Absence means the user wrote it — never write \`author: human\`.

**Tasks and meetings are committed work items.** Treat a new one as the user's call: surface
the candidate rather than creating the file yourself.

**\`.aiignore\`** at each workspace root lists paths the user has flagged as sensitive
(gitignore-style patterns). Honor it.`;
