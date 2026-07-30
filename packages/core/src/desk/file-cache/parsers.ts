/**
 * File Parsers
 *
 * Content parsers for use with FileTreeService.getContent()
 * Each parser transforms raw file content into a typed structure.
 */

import { parseMarkdown, generatePreview } from "../parser";
import {
  decodeDocFrontmatter,
  decodeTaskFrontmatter,
  reportFrontmatterDiagnostics,
} from "../frontmatter";
import type { TaskPriority, TaskStatus } from "../../types";
import type { ContentParser } from "./types";

/**
 * Parsed markdown document with frontmatter
 */
export interface ParsedMarkdownDoc {
  /** Frontmatter data */
  frontmatter: {
    title?: string;
    created?: string;
    status?: string;
    priority?: string;
    due?: string;
    project?: string;
    [key: string]: unknown;
  };
  /** Document body (without frontmatter) */
  content: string;
  /** Preview snippet */
  preview: string;
  /** Raw file content */
  raw: string;
}

/**
 * Parse a markdown file with frontmatter
 */
export const parseMarkdownDoc: ContentParser<ParsedMarkdownDoc> = (raw, path) => {
  try {
    const { data, content } = parseMarkdown<Record<string, unknown>>(raw);
    return {
      frontmatter: data as ParsedMarkdownDoc["frontmatter"],
      content,
      preview: generatePreview(content),
      raw,
    };
  } catch (error) {
    // If parsing fails, treat entire content as body
    console.warn(`[parsers] Failed to parse markdown: ${path}`, error);
    return {
      frontmatter: {},
      content: raw,
      preview: generatePreview(raw),
      raw,
    };
  }
};

/**
 * Doc-specific parsed content (matches Doc type structure)
 */
export interface ParsedDoc {
  title: string;
  created?: string;
  content: string;
  preview: string;
}

/**
 * Parse a doc file - extracts title, created date, content
 */
export function createDocParser(filename: string): ContentParser<ParsedDoc> {
  return (raw, path) => {
    const parsed = parseMarkdownDoc(raw, path);
    const nameWithoutExt = filename.replace(/\.md$/, "");
    const decoded = decodeDocFrontmatter(parsed.frontmatter, nameWithoutExt, filename);
    reportFrontmatterDiagnostics("document", path, decoded.diagnostics);

    return {
      title: decoded.value.title,
      created: decoded.value.created,
      content: parsed.content,
      preview: parsed.preview,
    };
  };
}

/**
 * Task-specific parsed content
 */
export interface ParsedTask {
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  created?: string;
  due?: string;
  content: string;
}

/**
 * Parse a task file
 */
export function createTaskParser(filename: string): ContentParser<ParsedTask> {
  return (raw, path) => {
    const parsed = parseMarkdownDoc(raw, path);
    const nameWithoutExt = filename.replace(/\.md$/, "");
    const decoded = decodeTaskFrontmatter(parsed.frontmatter, nameWithoutExt, filename);
    reportFrontmatterDiagnostics("task", path, decoded.diagnostics);

    return {
      title: decoded.value.title,
      status: decoded.value.status,
      priority: decoded.value.priority,
      created: decoded.value.created,
      due: decoded.value.due,
      content: parsed.content,
    };
  };
}

/**
 * JSON parser - for config and view state files
 */
export const parseJson: ContentParser<unknown> = (raw, path) => {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[parsers] Failed to parse JSON: ${path}`, error);
    return null;
  }
};

/**
 * Plain text parser - returns content as-is
 */
export const parsePlainText: ContentParser<string> = (raw) => raw;
