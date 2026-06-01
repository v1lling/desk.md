export function rowsToMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return "";

  const colCount = Math.max(...rows.map((r) => r.length));
  const normalized = rows.map((r) => {
    const padded = [...r];
    while (padded.length < colCount) padded.push("");
    return padded.map(escapeCell);
  });

  const [header, ...body] = normalized;
  const separator = Array(colCount).fill("---");

  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...body.map((r) => `| ${r.join(" | ")} |`),
  ];
  return lines.join("\n");
}

function escapeCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}
