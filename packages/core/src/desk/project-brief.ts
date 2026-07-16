/**
 * The project brief — `context/<date>-brief.md`.
 *
 * The brief is the human's half of a project's map: what this project is, which systems it
 * touches, why it exists. None of that is recoverable from the records, which is why the user
 * writes it — and why AI never touches this file. The AI-maintained half is the state file
 * (`project-state.ts`), a sibling in the same `context/` folder.
 *
 * This module owns the brief's *identity* and its *template*. The Context panel and (later) an
 * entity-shaped MCP `desk_orient` resolve the brief through `findProjectBrief`, so there is
 * exactly one definition of "which file is the brief".
 */
import type { Doc } from "../types";
import { formatLocalISODate } from "./parser";
import { getAllDocs } from "./content-tree";
import { createDocInFolder } from "./content-import";

/**
 * The brief's filename slug. A **constant**, deliberately not derived from the title:
 * `createDocInFolder` builds filenames from `generateFilename(title)`, so seeding with a title
 * of "Project Brief" (or a localized one) would silently produce `…-project-brief.md` and break
 * identity forever. Filenames are frozen once written, so this constant is the stable handle.
 */
const BRIEF_SLUG = "brief";

/** The brief's display title. Free to change; it is never used to locate the file. */
const BRIEF_TITLE = "Brief";

function briefFilename(date?: Date): string {
  return `${formatLocalISODate(date ?? new Date())}-${BRIEF_SLUG}.md`;
}

/**
 * Is this doc id the brief? Matches the frozen `YYYY-MM-DD-brief` filename, at the context
 * root only — a `context/archive/2026-01-01-brief.md` is an old copy, not the live map.
 */
function isBriefId(idOrPath: string): boolean {
  const id = idOrPath.replace(/\.md$/, "");
  if (id.includes("/")) return false;
  return new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${BRIEF_SLUG}$`).test(id);
}

/**
 * The brief among a project's context docs.
 *
 * Ties break on ascending `id`, not `created`: `created` is frontmatter (user-editable, and
 * absent entirely on hand-dropped files), whereas the id embeds a frozen date prefix and is
 * therefore a total, immutable order.
 */
export function findProjectBrief(contextDocs: readonly Doc[]): Doc | undefined {
  return contextDocs
    .filter((doc) => isBriefId(doc.path ?? doc.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
}

export interface BriefSeed {
  description?: string;
  systems?: string;
}

function briefTemplate(projectName: string, seed: BriefSeed = {}): string {
  const what = seed.description?.trim() || "";
  const systems = seed.systems?.trim() || "";
  return [
    `# ${projectName}`,
    "",
    "## What this is",
    "",
    what,
    "",
    "## Systems & stack",
    "",
    systems,
    "",
  ].join("\n");
}

/** True when there is something worth writing down. An empty brief is worse than none. */
export function hasSeedContent(seed: BriefSeed): boolean {
  return Boolean(seed.description?.trim() || seed.systems?.trim());
}

/**
 * Create the project's brief, or return the existing one.
 *
 * **Idempotent by necessity**, not by politeness: `writeMarkdownFile` does not check for an
 * existing file, so seeding twice on the same day would write the same filename and silently
 * destroy the brief. This reads first.
 */
export async function ensureProjectBrief(data: {
  workspaceId: string;
  projectId: string;
  projectName: string;
  seed?: BriefSeed;
}): Promise<Doc> {
  const existing = await getAllDocs("project", data.workspaceId, data.projectId, "context");
  const brief = findProjectBrief(existing);
  if (brief) return brief;

  return createDocInFolder({
    scope: "project",
    workspaceId: data.workspaceId,
    projectId: data.projectId,
    kind: "context",
    title: BRIEF_TITLE,
    filename: briefFilename(),
    content: briefTemplate(data.projectName, data.seed ?? {}),
  });
}
