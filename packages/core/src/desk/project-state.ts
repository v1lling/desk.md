/**
 * The project state file — `context/<date>-state.md`.
 *
 * The AI's half of a project's map. The brief (`project-brief.ts`) is the user's statement of
 * what the project is; the state file is the app-maintained snapshot of where it stands, rewritten
 * wholesale from the records. Splitting by FILE instead of by section is the safety mechanism:
 * the model only ever supplies the body of this one file, so the user's own words are never in
 * the write path at all — no merge machinery required.
 *
 * The app owns the file's lifecycle (path, filename, frontmatter, `author: ai`); the model owns
 * only the body text. Same frozen-slug identity pattern as the brief.
 */
import type { Doc } from "../types";
import { formatLocalISODate } from "./parser";
import { getAllDocs } from "./content-tree";
import { createDocInFolder } from "./content-import";
import { updateMarkdownFile } from "./file-operations";

const STATE_SLUG = "state";

/** Display title. Free to change; never used to locate the file. */
const STATE_TITLE = "Current state";

function stateFilename(date?: Date): string {
  return `${formatLocalISODate(date ?? new Date())}-${STATE_SLUG}.md`;
}

/**
 * Is this doc id the state file? Matches the frozen `YYYY-MM-DD-state` filename, at the context
 * root only — a `context/archive/2026-01-01-state.md` is an old copy, not the live snapshot.
 */
function isStateId(idOrPath: string): boolean {
  const id = idOrPath.replace(/\.md$/, "");
  if (id.includes("/")) return false;
  return new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${STATE_SLUG}$`).test(id);
}

/**
 * The state file among a project's context docs. Ties break on ascending `id` — same total,
 * immutable order as `findProjectBrief`.
 */
export function findProjectState(contextDocs: readonly Doc[]): Doc | undefined {
  return contextDocs
    .filter((doc) => isStateId(doc.path ?? doc.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
}

/**
 * Create or overwrite the project's state file with a model-supplied body.
 *
 * Wholesale replacement is correct here — this file is AI-owned in its entirety, and "reconcile,
 * don't append" is the whole point of a state snapshot. `title` and `author: ai` are re-asserted
 * on every write so a hand-stripped stamp heals itself; `updated` is stamped by the file helper.
 */
export async function writeProjectState(data: {
  workspaceId: string;
  projectId: string;
  body: string;
  /**
   * `updated` stamp for the snapshot: the time the RECORDS WERE READ, not "now". The AI call
   * between read and write takes seconds; stamping write-time would mark a record written in
   * that window as seen when it never reached the model.
   */
  snapshotAt?: string;
}): Promise<Doc> {
  const contextDocs = await getAllDocs("project", data.workspaceId, data.projectId, "context");
  const existing = findProjectState(contextDocs);

  if (existing?.filePath) {
    await updateMarkdownFile(
      existing.filePath,
      (fm) => ({
        frontmatter: { ...fm, title: STATE_TITLE, author: "ai" },
        content: data.body,
      }),
      { updatedStamp: data.snapshotAt },
    );
    return { ...existing, title: STATE_TITLE, author: "ai", content: data.body };
  }

  return createDocInFolder({
    scope: "project",
    workspaceId: data.workspaceId,
    projectId: data.projectId,
    kind: "context",
    title: STATE_TITLE,
    filename: stateFilename(),
    content: data.body,
    author: "ai",
    updatedStamp: data.snapshotAt,
  });
}
