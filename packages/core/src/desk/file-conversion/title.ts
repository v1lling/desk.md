/** Derive a readable document title from an imported filename. */
export function titleFromFilename(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  const base = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  return base.trim() || filename;
}
