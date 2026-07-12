export type ConvertibleKind = "docx" | "pdf" | "html" | "csv" | "xlsx" | "rtf" | "txt";

export interface ConversionResult {
  title: string;
  markdown: string;
  warnings?: string[];
}
