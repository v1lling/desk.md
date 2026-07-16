/**
 * Project state refresh — rewrite `context/<date>-state.md` from the brief + changed records.
 *
 * Safety model: no merge and no preview, because the model never touches the user's words at
 * all. The app owns the state file (path, frontmatter, `author: ai` — see `project-state.ts`);
 * the model supplies only the body. Wholesale rewrite is the contract.
 *
 * The loop terminates structurally: the scheduler only fires for RECORD paths (never
 * `context/`), and even a stray trigger no-ops because writing the state file bumps its stamp,
 * so `changedSince` recomputes to 0 at fire time.
 */
import type { Doc } from "../../types";
import { nowISO } from "../parser";
import { getAllDocs } from "../content-tree";
import { getTasksByProject } from "../tasks";
import { getMeetingsByProject } from "../meetings";
import { getProject } from "../projects";
import { findProjectBrief } from "../project-brief";
import { findProjectState, writeProjectState } from "../project-state";
import { loadAIIgnoreEntries, isPathExcludedByAIIgnore, toRelativePath } from "../aiignore";
import { computeContextFreshness, selectChangedRecords } from "../context-freshness";
import { getEditorNotifier } from "../editor-notifier";
import { getAIKeyResolver } from "../ai/key-resolver";
import { getProviderDefinition } from "../ai/provider-registry";
import { SYSTEM_PROMPTS } from "../ai/prompts";
import { getAIMaintenanceSettings, createMaintenanceService } from "./config";

/** The snapshot needs signal, not the full corpus, so only the head of the changed set is sent. */
const MAX_RECORDS = 25;
const MAX_RECORD_CHARS = 400;

export type StateRefreshResult = "written" | "skipped";

export async function performStateRefresh(
  workspaceId: string,
  projectId: string,
  opts: { manual: boolean; canRunAI: () => boolean | Promise<boolean> },
): Promise<StateRefreshResult> {
  try {
    const settings = await getAIMaintenanceSettings();
    if (!opts.manual && !settings.autoRefreshProjectState) return "skipped";

    // Host consent gate (the app's privacy consent; always-true on the server, where
    // configuring a key in the environment IS the operator's consent).
    if (!(await opts.canRunAI())) return "skipped";
    const key = await getAIKeyResolver()(getProviderDefinition(settings.providerType).keyRef);
    if (!key) return "skipped";

    // Captured BEFORE the reads: this becomes the snapshot's `updated` stamp. The AI call
    // below takes seconds; a record written during it must still count as unseen drift.
    const snapshotAt = nowISO();

    const [contextDocs, tasks, meetings, docs, project] = await Promise.all([
      getAllDocs("project", workspaceId, projectId, "context"),
      getTasksByProject(workspaceId, projectId),
      getMeetingsByProject(workspaceId, projectId),
      // Docs of kind "doc" only — context docs in the record set would compare the map
      // against itself.
      getAllDocs("project", workspaceId, projectId, "doc"),
      getProject(workspaceId, projectId),
    ]);

    const state = findProjectState(contextDocs);
    const records = selectChangedRecords(state, [...tasks, ...meetings, ...docs]);

    // Nothing the snapshot hasn't seen — a refresh would burn tokens to restate the file.
    // Self-terminating: our own write below bumps the state stamp, so this reads 0 next time.
    if (computeContextFreshness(state, records).changedSince === 0) {
      return "skipped";
    }

    // The state file is open in an editor tab: writing under it would leave the editor showing
    // stale content. Defer to the next trigger. (The seam's default is `false`, so on the
    // server — no tabs — this never blocks. A REMOTE client's open tab is invisible here;
    // accepted, same exposure as the manual refresh always had.)
    if (state?.filePath && getEditorNotifier().isOpen(state.filePath)) {
      return "skipped";
    }

    // .aiignore: excluded files must never reach the provider. The entity readers above have
    // no exclusion check (unlike the catalog builder), so enforce it here, on the payload
    // only — the drift COUNT above stays over all records, or an excluded file's edits would
    // silently stop marking the snapshot stale.
    const aiignoreEntries = await loadAIIgnoreEntries(workspaceId);
    const isIncluded = async (filePath: string) =>
      !isPathExcludedByAIIgnore(await toRelativePath(filePath, workspaceId), aiignoreEntries);
    const payloadRecords: typeof records = [];
    for (const record of records) {
      if (await isIncluded(record.filePath)) payloadRecords.push(record);
    }

    const brief = findProjectBrief(contextDocs);
    const includedBrief = brief && (await isIncluded(brief.filePath)) ? brief : undefined;
    const payload = buildStatePayload(project?.name ?? projectId, includedBrief, state, payloadRecords);

    const service = createMaintenanceService(settings, "context-refresh");

    const { message } = await service.custom(SYSTEM_PROMPTS.projectState, payload);
    const body = message.trim();
    if (!body) return "skipped";

    await writeProjectState({ workspaceId, projectId, body, snapshotAt });
    return "written";
  } catch (error) {
    if (opts.manual) throw error;
    console.warn("[maintenance] Background state refresh failed:", error);
    return "skipped";
  }
}

interface RecordLike {
  title: string;
  content?: string;
  updated?: string;
  created?: string;
}

/**
 * `records` is already the changed-since set, newest first (`selectChangedRecords`), so the
 * truncation keeps the most recent work rather than an arbitrary prefix.
 */
function buildStatePayload(
  projectName: string,
  brief: Doc | undefined,
  state: Doc | undefined,
  records: RecordLike[],
): string {
  const recent = records
    .slice(0, MAX_RECORDS)
    .map((r) => {
      const body = (r.content ?? "").trim().slice(0, MAX_RECORD_CHARS);
      const stamp = r.updated ?? r.created ?? "";
      // Fenced (~~~~, unlikely inside markdown bodies) so record text reads as data — a doc
      // containing "# Previous state file" or instruction prose must not spoof the protocol
      // headings of this payload. The system prompt states the same rule.
      return `### ${r.title}${stamp ? ` (${stamp})` : ""}\n~~~~\n${body}\n~~~~`;
    })
    .join("\n\n");

  return [
    `# Project: ${projectName}`,
    "",
    "# Brief (the user's own description)",
    "",
    brief?.content?.trim() || "(none)",
    "",
    "# Previous state file",
    "",
    state?.content?.trim() || "(none — this is the first snapshot; reconcile the full history below)",
    "",
    "# Records changed since the state was last written",
    "",
    recent || "(none)",
  ].join("\n");
}
