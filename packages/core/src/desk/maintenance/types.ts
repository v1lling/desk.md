/**
 * Maintenance engine shapes. The index data shapes (IndexEntry/WorkspaceIndex) live in
 * catalog/types.ts; these are the engine's own knobs and reporting shapes.
 */

export type SummaryDetail = "brief" | "standard" | "detailed";

const SUMMARY_PREVIEW_LENGTHS: Record<SummaryDetail, number> = {
  brief: 500,
  standard: 2000,
  detailed: 5000,
};

export function getSummaryPreviewLength(detail: SummaryDetail): number {
  return SUMMARY_PREVIEW_LENGTHS[detail];
}

/** Docs per AI call during a full rebuild. */
export const SUMMARY_BATCH_SIZE = 10;

export interface BuildIndexProgress {
  phase: "collecting" | "summarizing" | "done";
  total: number;
  processed: number;
  newOrChanged: number;
  currentWorkspace?: string;
}

export interface BuildIndexResult {
  totalFiles: number;
  summarized: number;
  reused: number;
  excluded: number;
  errors: string[];
}
