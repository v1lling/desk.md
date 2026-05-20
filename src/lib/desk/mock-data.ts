/**
 * Centralized mock data for browser development
 *
 * This file contains all mock data used when running outside of Tauri.
 * All data is defined here for:
 * - Easy modification and testing
 * - Single source of truth for mock state
 * - Clear separation between mock data and business logic
 *
 * Note: These arrays are mutable so CRUD operations work in browser mode.
 * All names below are fictional sample data.
 */

import type { Workspace, Project, Task, Doc, Meeting } from "@/types";

// ============================================================================
// WORKSPACES
// ============================================================================

export const mockWorkspaces: Workspace[] = [
  {
    id: "personal",
    name: "Personal",
    description: "Private tasks, docs, and projects",
    color: "#6366f1",
    created: "2024-01-01",
    isHome: true,
  },
  {
    id: "acme",
    name: "Acme Co",
    description: "Client work for Acme Co",
    color: "#3b82f6",
    created: "2024-01-01",
  },
  {
    id: "side-projects",
    name: "Side Projects",
    description: "Personal side projects and experiments",
    color: "#10b981",
    created: "2024-01-15",
  },
];

// ============================================================================
// PROJECTS
// ============================================================================

export const mockProjects: Project[] = [
  {
    id: "website-redesign",
    workspaceId: "acme",
    name: "Website Redesign",
    status: "active",
    description: "Redesign and rebuild the Acme Co marketing site",
    created: "2024-01-01",
    taskCount: 4,
    tasksByStatus: { backlog: 0, todo: 1, doing: 2, waiting: 0, done: 1 },
    docCount: 2,
    meetingCount: 3,
  },
  {
    id: "data-migration",
    workspaceId: "acme",
    name: "Data Migration",
    status: "active",
    description: "Migrate legacy CRM data to the new platform",
    created: "2024-01-05",
    taskCount: 1,
    tasksByStatus: { backlog: 0, todo: 1, doing: 0, waiting: 0, done: 0 },
    docCount: 1,
    meetingCount: 1,
  },
  {
    id: "api-v2",
    workspaceId: "acme",
    name: "API v2",
    status: "paused",
    description: "Next-generation REST API",
    created: "2023-11-15",
    taskCount: 0,
    tasksByStatus: { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 0 },
    docCount: 0,
    meetingCount: 0,
  },
  {
    id: "main",
    workspaceId: "side-projects",
    name: "Main Project",
    status: "active",
    description: "Primary development work",
    created: "2024-01-10",
    taskCount: 0,
    tasksByStatus: { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 0 },
    docCount: 0,
    meetingCount: 0,
  },
];

// ============================================================================
// TASKS
// ============================================================================

export const mockTasks: Task[] = [
  {
    id: "2024-01-15-contact-form",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/tasks/2024-01-15-contact-form.md",
    title: "Set up the contact form endpoint",
    status: "doing",
    priority: "high",
    due: "2024-01-20",
    created: "2024-01-15",
    content: "Wire up the contact form on the new site.\n\n## Steps\n- [ ] Get API credentials\n- [ ] Configure endpoint\n- [ ] Test with a sample submission",
  },
  {
    id: "2024-01-14-review-docs",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/tasks/2024-01-14-review-docs.md",
    title: "Review API documentation",
    status: "todo",
    priority: "medium",
    created: "2024-01-14",
    content: "Go through the updated API docs and note any breaking changes.",
  },
  {
    id: "2024-01-13-fix-auth-bug",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/tasks/2024-01-13-fix-auth-bug.md",
    title: "Fix authentication timeout bug",
    status: "done",
    priority: "high",
    created: "2024-01-13",
    content: "Users getting logged out after 5 minutes. Need to increase token lifetime.",
  },
  {
    id: "2024-01-12-write-specs",
    projectId: "data-migration",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/data-migration/tasks/2024-01-12-write-specs.md",
    title: "Write migration specs",
    status: "todo",
    priority: "low",
    created: "2024-01-12",
    content: "Document the data migration process.",
  },
  {
    id: "2024-01-11-email-followup",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/tasks/2024-01-11-email-followup.md",
    title: "Email follow-up with the client",
    status: "doing",
    created: "2024-01-11",
    content: "Follow up on the integration timeline.",
  },
];

// ============================================================================
// DOCS
// ============================================================================

export const mockDocs: Doc[] = [
  {
    id: "2024-01-15-meeting-client",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/docs/2024-01-15-meeting-client.md",
    title: "Meeting with the client",
    created: "2024-01-15",
    content: "# Meeting with the client\n\n**Date:** 2024-01-15\n**Attendees:** Alex, Sam, Jordan\n\n## Agenda\n- Discuss the contact form integration\n- Review timeline\n- Address security concerns\n\n## Notes\nThey want to go live by end of February. Need to prioritize the contact form setup.\n\n## Action Items\n- [ ] Send API documentation\n- [ ] Schedule follow-up call\n- [ ] Prepare security audit report",
    preview: "Meeting with the client - Date: 2024-01-15, Attendees: Alex, Sam, Jordan...",
  },
  {
    id: "2024-01-12-api-changes",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/docs/2024-01-12-api-changes.md",
    title: "API v2 Changes Summary",
    created: "2024-01-12",
    content: "# API v2 Changes Summary\n\n## Breaking Changes\n- Authentication endpoint moved to `/auth/v2`\n- Response format changed to JSON:API spec\n- Rate limiting now 100 req/min\n\n## New Features\n- Batch operations support\n- Webhook callbacks\n- GraphQL endpoint (beta)\n\n## Migration Guide\nSee docs at `/docs/migration-v2`",
    preview: "API v2 Changes Summary - Breaking Changes: Authentication endpoint moved...",
  },
  {
    id: "2024-01-10-migration-kickoff",
    projectId: "data-migration",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/data-migration/docs/2024-01-10-migration-kickoff.md",
    title: "Data Migration Kickoff",
    created: "2024-01-10",
    content: "# Data Migration Kickoff\n\n## Project Overview\nMigrating from the legacy system to the new platform.\n\n## Timeline\n- Phase 1: Data mapping (Jan-Feb)\n- Phase 2: Test migration (Mar)\n- Phase 3: Production migration (Apr)\n\n## Team\n- Lead: Morgan\n- Technical: Alex, Chris\n- Support: Lisa",
    preview: "Data Migration Kickoff - Project Overview: Migrating from the legacy system...",
  },
  {
    id: "2024-01-16-context-website",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/ai-docs/2024-01-16-context-website.md",
    title: "Website Redesign context (AI-distilled)",
    created: "2024-01-16",
    content: "# Website Redesign context\n\nDistilled from kickoff meetings and email threads.\n\n## Stakeholders\n- The client — target end-of-February go-live.\n\n## Outstanding risks\n- API credentials still pending from the client.\n- Security audit not yet scheduled.",
    preview: "Website Redesign context - distilled from kickoff meetings and email threads...",
  },
  {
    id: "2024-01-14-research-webhook-auth",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/ai-docs/2024-01-14-research-webhook-auth.md",
    title: "Research: webhook auth approaches",
    created: "2024-01-14",
    content: "# Research: webhook auth approaches\n\nNotes comparing HMAC-signed payloads vs. mTLS for the contact form webhook.",
    preview: "Research notes comparing HMAC-signed payloads vs. mTLS for webhooks...",
  },
];

// ============================================================================
// MEETINGS
// ============================================================================

export const mockMeetings: Meeting[] = [
  {
    id: "2024-01-15-weekly-sync",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/meetings/2024-01-15-weekly-sync.md",
    title: "Weekly Sync",
    date: "2024-01-15",
    created: "2024-01-15",
    attendees: ["You", "Morgan", "Taylor"],
    content: "# Weekly Sync\n\n## Attendees\n- You\n- Morgan\n- Taylor\n\n## Agenda\n1. Review last week's progress\n2. Blockers and issues\n3. Plan for this week\n\n## Notes\n- Contact form integration is on track\n- Need to follow up with the client on API credentials\n- Security review scheduled for Friday\n\n## Action Items\n- [ ] You: Finish the contact form endpoint\n- [ ] Morgan: Send security requirements doc\n- [ ] Taylor: Update project timeline",
    preview: "Weekly Sync - Review last week's progress, blockers, plan for this week...",
  },
  {
    id: "2024-01-12-kickoff-client",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/meetings/2024-01-12-kickoff-client.md",
    title: "Client Kickoff",
    date: "2024-01-12",
    created: "2024-01-12",
    attendees: ["You", "Alex (Client)", "Sam (Client)"],
    content: "# Client Kickoff\n\n## Attendees\n- You\n- Alex (Client)\n- Sam (Client)\n\n## Purpose\nKickoff meeting for the website redesign.\n\n## Discussion\n- Overview of the new site structure\n- Technical requirements and integration timeline\n- Go-live target: End of February\n\n## Decisions\n- Will use a webhook-based integration\n- Security audit required before go-live\n- Weekly status updates via email\n\n## Next Steps\n- [ ] Provide API documentation\n- [ ] Client to share their current system details\n- [ ] Schedule technical deep-dive for next week",
    preview: "Client Kickoff - Kickoff meeting for the website redesign...",
  },
  {
    id: "2024-01-08-sprint-planning",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/meetings/2024-01-08-sprint-planning.md",
    title: "Sprint Planning - January",
    date: "2024-01-08",
    created: "2024-01-08",
    attendees: ["You", "Morgan", "Alex"],
    content: "# Sprint Planning - January\n\n## Sprint Goal\nComplete the website redesign foundation.\n\n## Planned Work\n1. Contact form endpoint setup (8 points)\n2. Authentication flow updates (5 points)\n3. Documentation updates (3 points)\n4. Security review preparation (5 points)\n\n## Capacity\n- You: 80%\n- Morgan: 60%\n- Alex: 100%\n\n## Risks\n- Dependency on the client providing credentials\n- Potential security review delays",
    preview: "Sprint Planning - January - Complete the website redesign foundation...",
  },
  {
    id: "2024-01-10-data-mapping-review",
    projectId: "data-migration",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/data-migration/meetings/2024-01-10-data-mapping-review.md",
    title: "Data Mapping Review",
    date: "2024-01-10",
    created: "2024-01-10",
    attendees: ["You", "Lisa", "Chris"],
    content: "# Data Mapping Review\n\n## Purpose\nReview initial data mapping between the legacy system and the new platform.\n\n## Key Findings\n- 85% of fields have direct mapping\n- 10% need transformation logic\n- 5% have no equivalent (need decisions)\n\n## Problem Fields\n- Custom customer categories\n- Historical transaction data format\n- Legacy ID formats\n\n## Decisions\n- Transform customer categories to the new platform's groups\n- Archive historical data separately\n- Create an ID migration script\n\n## Next Meeting\nScheduled for Jan 17 to review transformation logic",
    preview: "Data Mapping Review - Review initial data mapping between the legacy system...",
  },
];
