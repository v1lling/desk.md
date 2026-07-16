/**
 * Incremental Smart Index update for one file — the engine's reaction to a record write.
 *
 * Port of the app's old on-save indexer, minus the host glue: input is just the absolute
 * file path (identity derived via path-identity), content is read from storage (the engine
 * only runs where the domain is local), and the result is written straight into the persisted
 * index file. Metadata always updates; the AI summary regenerates only when the body hash
 * changed AND a key + the auto-summarize toggle + the host consent gate allow it.
 */
import { getStorage } from "../storage";
import {
  parseMarkdown,
  filenameToId,
  resolveContentDate,
  normalizeDateTime,
  normalizeOptionalDate,
} from "../parser";
import { hashContent, extractBody } from "../catalog/content-utils";
import { buildCatalogEntry } from "../catalog/entry-factory";
import type { IndexEntry } from "../catalog/types";
import { getAIInclusion } from "../aiignore";
import { SPECIAL_DIRS, WORKSPACE_LEVEL_PROJECT_ID } from "../constants";
import { getItemTypeFromPath, getWorkspaceIdFromPath, getProjectIdFromPath } from "../path-identity";
import { getAIKeyResolver } from "../ai/key-resolver";
import { getProviderDefinition } from "../ai/provider-registry";
import { SYSTEM_PROMPTS } from "../ai/prompts";
import { getAIMaintenanceSettings, createMaintenanceService } from "./config";
import { getSummaryPreviewLength } from "./types";
import { readWorkspaceIndex, upsertIndexEntry, removeIndexEntry } from "./index-store-io";

export async function removeFileFromIndex(filePath: string): Promise<void> {
  const workspaceId = getWorkspaceIdFromPath(filePath);
  if (!workspaceId) return;
  await removeIndexEntry(workspaceId, filePath);
}

export async function updateIndexForFile(
  filePath: string,
  canRunAI: () => boolean | Promise<boolean>,
): Promise<void> {
  const itemType = getItemTypeFromPath(filePath);
  if (itemType !== "task" && itemType !== "doc" && itemType !== "meeting") return;
  const workspaceId = getWorkspaceIdFromPath(filePath);
  if (!workspaceId) return;

  try {
    // .aiignore: an excluded file must not sit in the catalog at all.
    const isIncluded = await getAIInclusion(filePath, workspaceId);
    if (!isIncluded) {
      await removeIndexEntry(workspaceId, filePath);
      return;
    }

    if (!(await getStorage().exists(filePath))) {
      await removeIndexEntry(workspaceId, filePath);
      return;
    }

    const content = await getStorage().readTextFile(filePath);
    const { data: frontmatter } = parseMarkdown<Record<string, unknown>>(content);
    const filename = filePath.split("/").pop() ?? "";
    const title =
      typeof frontmatter.title === "string" && frontmatter.title
        ? frontmatter.title
        : typeof frontmatter.name === "string" && frontmatter.name
          ? frontmatter.name
          : filenameToId(filename);

    // Hash the body (frontmatter stripped) — must match the full-rebuild path so summaries
    // reuse correctly across both.
    const contentHash = await hashContent(extractBody(content));
    const index = await readWorkspaceIndex(workspaceId);
    const existingEntry = index?.entries.find((e) => e.filePath === filePath);
    const hashChanged = existingEntry ? existingEntry.contentHash !== contentHash : true;

    const settings = await getAIMaintenanceSettings();
    const key = await getAIKeyResolver()(getProviderDefinition(settings.providerType).keyRef);
    const shouldGenerateSummary =
      settings.autoSummarizeOnSave && hashChanged && !!key && (await canRunAI());

    // Keep the previous summary by default (may be undefined). Keyless updates carry
    // metadata only — never a fabricated summary.
    let summary = existingEntry?.summary;

    if (shouldGenerateSummary) {
      try {
        const service = createMaintenanceService(settings, "index");
        const body = extractBody(content);
        const preview = body.slice(0, getSummaryPreviewLength(settings.summaryDetail));
        // Fenced so document text reads as data, not instructions (see the system prompt).
        const response = await service.custom(
          SYSTEM_PROMPTS.autoSummarize,
          `Title: ${title}\nType: ${itemType}\n~~~~\n${preview}\n~~~~`,
        );
        summary = response.message.trim() || summary;
      } catch (error) {
        console.warn("[maintenance] Failed to regenerate summary:", error);
        // Keep the previous summary (may be undefined) — never fabricate one.
      }
    }

    // Same projectId convention as the entity readers: real project id from the path,
    // `_unassigned` for the unassigned dirs, workspace-level marker otherwise.
    const projectId =
      getProjectIdFromPath(filePath) ??
      (filePath.includes(`/${SPECIAL_DIRS.UNASSIGNED}/`) || filePath.includes(`/${SPECIAL_DIRS.CAPTURE}/`)
        ? SPECIAL_DIRS.UNASSIGNED
        : WORKSPACE_LEVEL_PROJECT_ID);

    const meta = await buildCatalogEntry({
      filePath,
      workspaceId,
      type: itemType,
      title,
      projectId,
      // The entity readers' normalizers, not raw typeof checks: YAML parses unquoted dates
      // as Date OBJECTS, which a string check silently drops. The catalog must agree with
      // what the app shows.
      created: resolveContentDate(frontmatter.created, filename),
      updated: normalizeDateTime(frontmatter.updated),
      status: typeof frontmatter.status === "string" ? frontmatter.status : undefined,
      priority: typeof frontmatter.priority === "string" ? frontmatter.priority : undefined,
      date: normalizeOptionalDate(frontmatter.date),
      author: frontmatter.author === "ai" ? "ai" : undefined,
      content,
    });

    const entry: IndexEntry = { ...meta };
    if (summary) entry.summary = summary;
    await upsertIndexEntry(workspaceId, entry);
  } catch (error) {
    console.error("[maintenance] Failed to update index entry:", error);
  }
}
