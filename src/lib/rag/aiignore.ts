/**
 * .aiignore file parser
 *
 * Follows .gitignore syntax (simplified):
 * - Lines starting with # are comments
 * - Empty lines are ignored
 * - * matches any file
 * - *.ext matches files with extension
 * - folder/ matches all contents of folder
 * - !pattern negates a previous pattern
 */

export interface AIIgnoreRule {
  pattern: string;
  isNegation: boolean;
  isDirectory: boolean;
}

/**
 * Parse .aiignore file content into rules
 */
export function parseAIIgnore(content: string): AIIgnoreRule[] {
  const rules: AIIgnoreRule[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    let pattern = trimmed;
    let isNegation = false;

    // Check for negation
    if (pattern.startsWith('!')) {
      isNegation = true;
      pattern = pattern.slice(1);
    }

    // Check if it's a directory pattern
    const isDirectory = pattern.endsWith('/');
    if (isDirectory) {
      pattern = pattern.slice(0, -1);
    }

    rules.push({ pattern, isNegation, isDirectory });
  }

  return rules;
}

/**
 * Convert glob pattern to regex
 */
function globToRegex(pattern: string): RegExp {
  let regex = pattern
    // Escape special regex characters except * and ?
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // Convert glob * to regex .*
    .replace(/\*/g, '.*')
    // Convert glob ? to regex .
    .replace(/\?/g, '.');

  return new RegExp(`^${regex}$`);
}

/**
 * Check if a path matches a single rule
 */
function matchesRule(path: string, rule: AIIgnoreRule): boolean {
  const normalizedPath = path.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  const filename = parts[parts.length - 1];

  // For directory patterns, check if any parent matches
  if (rule.isDirectory) {
    for (const part of parts.slice(0, -1)) {
      if (globToRegex(rule.pattern).test(part)) {
        return true;
      }
    }
    return false;
  }

  // For file patterns, check filename or full path
  const regex = globToRegex(rule.pattern);
  return regex.test(filename) || regex.test(normalizedPath);
}

/**
 * Check if a path should be excluded based on .aiignore rules
 *
 * @param path - The path to check (relative to the .aiignore location)
 * @param rules - Parsed .aiignore rules
 * @returns true if the path should be excluded
 */
export function isExcluded(path: string, rules: AIIgnoreRule[]): boolean {
  let excluded = false;

  for (const rule of rules) {
    if (matchesRule(path, rule)) {
      excluded = !rule.isNegation;
    }
  }

  return excluded;
}

/**
 * Check if a path should be excluded, supporting multiple .aiignore files
 * in the directory hierarchy
 *
 * @param path - Full path to check
 * @param aiignoreFiles - Map of directory paths to their .aiignore rules
 * @returns true if the path should be excluded
 */
export function isExcludedByHierarchy(
  path: string,
  aiignoreFiles: Map<string, AIIgnoreRule[]>
): boolean {
  const normalizedPath = path.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');

  // Check each level of the hierarchy
  for (let i = 0; i < parts.length; i++) {
    const dirPath = parts.slice(0, i + 1).join('/');
    const rules = aiignoreFiles.get(dirPath);

    if (rules) {
      const relativePath = parts.slice(i + 1).join('/');
      if (relativePath && isExcluded(relativePath, rules)) {
        return true;
      }
    }
  }

  return false;
}
