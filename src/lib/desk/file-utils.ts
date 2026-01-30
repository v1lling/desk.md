/**
 * File type utilities for distinguishing markdown docs from other assets
 */

// Markdown extensions that should be editable in Desk
export const MARKDOWN_EXTENSIONS = ['md', 'markdown'] as const;

// Common file type categories for icon selection
export const FILE_CATEGORIES = {
  document: ['doc', 'docx', 'pdf', 'txt', 'rtf', 'odt', 'pages'],
  spreadsheet: ['xls', 'xlsx', 'csv', 'ods', 'numbers'],
  presentation: ['ppt', 'pptx', 'odp', 'key'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff', 'heic'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'dmg'],
  code: ['js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'rb', 'php', 'swift', 'kt'],
  data: ['json', 'yaml', 'yml', 'xml', 'toml', 'ini', 'env'],
} as const;

export type FileCategory = keyof typeof FILE_CATEGORIES;

/**
 * Get the extension from a filename (without the dot)
 */
export function getExtension(filename: string): string | undefined {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) {
    return undefined;
  }
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Check if a file is a markdown file (editable in Desk)
 */
export function isMarkdownFile(filename: string): boolean {
  const ext = getExtension(filename);
  return ext ? (MARKDOWN_EXTENSIONS as readonly string[]).includes(ext) : false;
}

/**
 * Get the category of a file based on its extension
 */
export function getFileCategory(extension: string): FileCategory | undefined {
  const ext = extension.toLowerCase();
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if ((extensions as readonly string[]).includes(ext)) {
      return category as FileCategory;
    }
  }
  return undefined;
}
