/**
 * Template defaults and variable resolution for item creation.
 *
 * Templates are markdown body content pre-filled when creating new items.
 * Hard properties (title, status, priority, etc.) stay in YAML frontmatter.
 */

export type TemplateType = "task" | "meeting" | "doc";

export interface TemplatesConfig {
  task?: string;
  meeting?: string;
  doc?: string;
}

/** Hardcoded fallback templates (used when no global or workspace template is set) */
export const DEFAULT_TEMPLATES: Record<TemplateType, string> = {
  meeting: `## Attendees\n- \n\n## Agenda\n- \n\n## Notes\n\n\n## Action Items\n- [ ] `,
  doc: "",
  task: "",
};

interface TemplateVariables {
  title: string;
  date: string;
  project: string;
  workspace: string;
}

/** Replace {{variable}} placeholders in a template string */
export function resolveVariables(template: string, vars: TemplateVariables): string {
  return template
    .replace(/\{\{title\}\}/g, vars.title)
    .replace(/\{\{date\}\}/g, vars.date)
    .replace(/\{\{project\}\}/g, vars.project)
    .replace(/\{\{workspace\}\}/g, vars.workspace);
}
