import type {
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "../types";
import {
  normalizeDateTime,
  normalizeOptionalDate,
  resolveContentDate,
  todayISO,
} from "./parser";

export interface FrontmatterDiagnostic {
  field: string;
  message: string;
}

export interface DecodedFrontmatter<T> {
  value: T;
  diagnostics: FrontmatterDiagnostic[];
}

export interface WorkspaceMetadata {
  name: string;
  description?: string;
  color?: string;
  created: string;
  home: boolean;
}

export interface ProjectMetadata {
  name: string;
  status: ProjectStatus;
  description?: string;
  created: string;
}

export interface TaskMetadata {
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  due?: string;
  created?: string;
  updated?: string;
  author?: "ai";
}

export interface DocMetadata {
  title: string;
  created?: string;
  updated?: string;
  author?: "ai";
}

export interface MeetingMetadata extends DocMetadata {
  date?: string;
}

const PROJECT_STATUSES = ["active", "paused", "completed", "archived"] as const;
const TASK_STATUSES = ["backlog", "todo", "doing", "waiting", "done"] as const;
const TASK_PRIORITIES = ["low", "medium", "high"] as const;

/**
 * Report recoverable metadata problems without dropping the containing record.
 * Callers still receive a value built from documented defaults.
 */
export function reportFrontmatterDiagnostics(
  entity: string,
  path: string,
  diagnostics: FrontmatterDiagnostic[],
): void {
  for (const diagnostic of diagnostics) {
    console.warn(
      `[frontmatter] ${entity} "${path}" has invalid "${diagnostic.field}": ${diagnostic.message}`,
    );
  }
}

export function decodeWorkspaceFrontmatter(
  input: unknown,
  fallbackName: string,
): DecodedFrontmatter<WorkspaceMetadata> {
  const diagnostics: FrontmatterDiagnostic[] = [];
  const data = record(input, diagnostics);
  return {
    value: {
      name: requiredString(data, "name", fallbackName, diagnostics),
      description: optionalString(data, "description", diagnostics),
      color: optionalString(data, "color", diagnostics),
      created: requiredDate(data, "created", diagnostics),
      home: optionalBoolean(data, "home", diagnostics) ?? false,
    },
    diagnostics,
  };
}

export function decodeProjectFrontmatter(
  input: unknown,
  fallbackName: string,
): DecodedFrontmatter<ProjectMetadata> {
  const diagnostics: FrontmatterDiagnostic[] = [];
  const data = record(input, diagnostics);
  return {
    value: {
      name: requiredString(data, "name", fallbackName, diagnostics),
      status: enumValue(data, "status", PROJECT_STATUSES, "active", diagnostics),
      description: optionalString(data, "description", diagnostics),
      created: requiredDate(data, "created", diagnostics),
    },
    diagnostics,
  };
}

export function decodeTaskFrontmatter(
  input: unknown,
  fallbackTitle: string,
  filename: string,
): DecodedFrontmatter<TaskMetadata> {
  const diagnostics: FrontmatterDiagnostic[] = [];
  const data = record(input, diagnostics);
  return {
    value: {
      title: requiredString(data, "title", fallbackTitle, diagnostics),
      status: enumValue(data, "status", TASK_STATUSES, "todo", diagnostics),
      priority: optionalEnum(data, "priority", TASK_PRIORITIES, diagnostics),
      due: optionalDate(data, "due", diagnostics),
      created: contentDate(data, "created", filename, diagnostics),
      updated: optionalDateTime(data, "updated", diagnostics),
      author: optionalAuthor(data, diagnostics),
    },
    diagnostics,
  };
}

export function decodeDocFrontmatter(
  input: unknown,
  fallbackTitle: string,
  filename: string,
): DecodedFrontmatter<DocMetadata> {
  const diagnostics: FrontmatterDiagnostic[] = [];
  const data = record(input, diagnostics);
  return {
    value: {
      title: requiredString(data, "title", fallbackTitle, diagnostics),
      created: contentDate(data, "created", filename, diagnostics),
      updated: optionalDateTime(data, "updated", diagnostics),
      author: optionalAuthor(data, diagnostics),
    },
    diagnostics,
  };
}

export function decodeMeetingFrontmatter(
  input: unknown,
  fallbackTitle: string,
  filename: string,
): DecodedFrontmatter<MeetingMetadata> {
  const diagnostics: FrontmatterDiagnostic[] = [];
  const data = record(input, diagnostics);
  const created = contentDate(data, "created", filename, diagnostics);
  const explicitDate = optionalDate(data, "date", diagnostics);
  return {
    value: {
      title: requiredString(data, "title", fallbackTitle, diagnostics),
      date: explicitDate ?? created,
      created,
      updated: optionalDateTime(data, "updated", diagnostics),
      author: optionalAuthor(data, diagnostics),
    },
    diagnostics,
  };
}

function record(
  input: unknown,
  diagnostics: FrontmatterDiagnostic[],
): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  diagnostics.push({ field: "$frontmatter", message: "expected a mapping; using defaults" });
  return {};
}

function requiredString(
  data: Record<string, unknown>,
  field: string,
  fallback: string,
  diagnostics: FrontmatterDiagnostic[],
): string {
  const value = data[field];
  if (typeof value === "string" && value.trim()) return value;
  diagnostics.push({
    field,
    message: value === undefined
      ? `field is missing; using "${fallback}"`
      : `expected a non-empty string; using "${fallback}"`,
  });
  return fallback;
}

function optionalString(
  data: Record<string, unknown>,
  field: string,
  diagnostics: FrontmatterDiagnostic[],
): string | undefined {
  const value = data[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string") return value;
  diagnostics.push({ field, message: "expected a string; ignoring value" });
  return undefined;
}

function optionalBoolean(
  data: Record<string, unknown>,
  field: string,
  diagnostics: FrontmatterDiagnostic[],
): boolean | undefined {
  const value = data[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  diagnostics.push({ field, message: "expected a boolean; ignoring value" });
  return undefined;
}

function enumValue<const T extends readonly string[]>(
  data: Record<string, unknown>,
  field: string,
  allowed: T,
  fallback: T[number],
  diagnostics: FrontmatterDiagnostic[],
): T[number] {
  const value = data[field];
  if (typeof value === "string" && allowed.includes(value)) return value as T[number];
  if (value !== undefined) {
    diagnostics.push({
      field,
      message: `expected one of ${allowed.join(", ")}; using "${fallback}"`,
    });
  }
  return fallback;
}

function optionalEnum<const T extends readonly string[]>(
  data: Record<string, unknown>,
  field: string,
  allowed: T,
  diagnostics: FrontmatterDiagnostic[],
): T[number] | undefined {
  const value = data[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string" && allowed.includes(value)) return value as T[number];
  diagnostics.push({
    field,
    message: `expected one of ${allowed.join(", ")}; ignoring value`,
  });
  return undefined;
}

function requiredDate(
  data: Record<string, unknown>,
  field: string,
  diagnostics: FrontmatterDiagnostic[],
): string {
  const value = data[field];
  const normalized = normalizeOptionalDate(value);
  if (normalized) return normalized;
  const fallback = todayISO();
  diagnostics.push({
    field,
    message: `${value === undefined ? "field is missing" : "expected a valid date"}; using "${fallback}"`,
  });
  return fallback;
}

function optionalDate(
  data: Record<string, unknown>,
  field: string,
  diagnostics: FrontmatterDiagnostic[],
): string | undefined {
  const value = data[field];
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = normalizeOptionalDate(value);
  if (normalized) return normalized;
  diagnostics.push({ field, message: "expected a valid date; ignoring value" });
  return undefined;
}

function contentDate(
  data: Record<string, unknown>,
  field: string,
  filename: string,
  diagnostics: FrontmatterDiagnostic[],
): string | undefined {
  const value = data[field];
  if (value !== undefined && value !== null && value !== "" && !normalizeOptionalDate(value)) {
    diagnostics.push({ field, message: "expected a valid date; using filename fallback if available" });
  }
  return resolveContentDate(value, filename);
}

function optionalDateTime(
  data: Record<string, unknown>,
  field: string,
  diagnostics: FrontmatterDiagnostic[],
): string | undefined {
  const value = data[field];
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = normalizeDateTime(value);
  if (normalized) return normalized;
  diagnostics.push({ field, message: "expected a valid date-time; ignoring value" });
  return undefined;
}

function optionalAuthor(
  data: Record<string, unknown>,
  diagnostics: FrontmatterDiagnostic[],
): "ai" | undefined {
  const value = data.author;
  if (value === undefined || value === null || value === "") return undefined;
  if (value === "ai") return "ai";
  diagnostics.push({ field: "author", message: 'only "ai" is supported; treating as user-authored' });
  return undefined;
}
