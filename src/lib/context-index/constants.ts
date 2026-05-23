export type SummaryDetail = "brief" | "standard" | "detailed";

export const SUMMARY_PREVIEW_LENGTHS: Record<SummaryDetail, number> = {
  brief: 500,
  standard: 2000,
  detailed: 5000,
};

export function getSummaryPreviewLength(detail: SummaryDetail): number {
  return SUMMARY_PREVIEW_LENGTHS[detail];
}
