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
 */

import type { Workspace, Project, Task, Doc, Meeting } from "@/types";

// ============================================================================
// WORKSPACES
// ============================================================================

export const mockWorkspaces: Workspace[] = [
  {
    id: "slsp",
    name: "SLSP",
    description: "Swiss Library Service Platform",
    color: "#3b82f6",
    created: "2024-01-01",
  },
  {
    id: "sss",
    name: "SSS",
    description: "SSS Project",
    color: "#10b981",
    created: "2024-01-15",
  },
];

// ============================================================================
// PROJECTS
// ============================================================================

export const mockProjects: Project[] = [
  {
    id: "slskey",
    workspaceId: "slsp",
    name: "SLSKey",
    status: "active",
    description: "Swiss Library Service Key authentication system",
    created: "2024-01-01",
    taskCount: 4,
    tasksByStatus: { todo: 1, doing: 2, waiting: 0, done: 1 },
  },
  {
    id: "alma-migration",
    workspaceId: "slsp",
    name: "Alma Migration",
    status: "active",
    description: "Migration of library data to Ex Libris Alma",
    created: "2024-01-05",
    taskCount: 1,
    tasksByStatus: { todo: 1, doing: 0, waiting: 0, done: 0 },
  },
  {
    id: "api-v2",
    workspaceId: "slsp",
    name: "API v2",
    status: "paused",
    description: "Next generation REST API",
    created: "2023-11-15",
    taskCount: 0,
    tasksByStatus: { todo: 0, doing: 0, waiting: 0, done: 0 },
  },
  {
    id: "main",
    workspaceId: "sss",
    name: "Main Project",
    status: "active",
    description: "Primary SSS development work",
    created: "2024-01-10",
    taskCount: 0,
    tasksByStatus: { todo: 0, doing: 0, waiting: 0, done: 0 },
  },
];

// ============================================================================
// TASKS
// ============================================================================

export const mockTasks: Task[] = [
  {
    id: "2024-01-15-setup-webhook",
    projectId: "slskey",
    workspaceId: "slsp",
    filePath: "~/Orbit/workspaces/slsp/projects/slskey/tasks/2024-01-15-setup-webhook.md",
    title: "Setup webhook for ZB Winterthur",
    status: "doing",
    priority: "high",
    due: "2024-01-20",
    created: "2024-01-15",
    content: "Configure Alma webhook endpoint for the new library.\n\n## Steps\n- [ ] Get API credentials\n- [ ] Configure endpoint\n- [ ] Test with sample user",
  },
  {
    id: "2024-01-14-review-docs",
    projectId: "slskey",
    workspaceId: "slsp",
    filePath: "~/Orbit/workspaces/slsp/projects/slskey/tasks/2024-01-14-review-docs.md",
    title: "Review API documentation",
    status: "todo",
    priority: "medium",
    created: "2024-01-14",
    content: "Go through the updated API docs and note any breaking changes.",
  },
  {
    id: "2024-01-13-fix-auth-bug",
    projectId: "slskey",
    workspaceId: "slsp",
    filePath: "~/Orbit/workspaces/slsp/projects/slskey/tasks/2024-01-13-fix-auth-bug.md",
    title: "Fix authentication timeout bug",
    status: "done",
    priority: "high",
    created: "2024-01-13",
    content: "Users getting logged out after 5 minutes. Need to increase token lifetime.",
  },
  {
    id: "2024-01-12-write-specs",
    projectId: "alma-migration",
    workspaceId: "slsp",
    filePath: "~/Orbit/workspaces/slsp/projects/alma-migration/tasks/2024-01-12-write-specs.md",
    title: "Write migration specs",
    status: "todo",
    priority: "low",
    created: "2024-01-12",
    content: "Document the data migration process for Alma.",
  },
  {
    id: "2024-01-11-email-followup",
    projectId: "slskey",
    workspaceId: "slsp",
    filePath: "~/Orbit/workspaces/slsp/projects/slskey/tasks/2024-01-11-email-followup.md",
    title: "Email follow-up with library",
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
    id: "2024-01-15-meeting-zb-winterthur",
    projectId: "slskey",
    workspaceId: "slsp",
    filePath: "~/Orbit/workspaces/slsp/projects/slskey/docs/2024-01-15-meeting-zb-winterthur.md",
    title: "Meeting with ZB Winterthur",
    created: "2024-01-15",
    content: "# Meeting with ZB Winterthur\n\n**Date:** 2024-01-15\n**Attendees:** John, Sarah, Mike\n\n## Agenda\n- Discuss webhook integration\n- Review timeline\n- Address security concerns\n\n## Notes\nThey want to go live by end of February. Need to prioritize the webhook setup.\n\n## Action Items\n- [ ] Send API documentation\n- [ ] Schedule follow-up call\n- [ ] Prepare security audit report",
    preview: "Meeting with ZB Winterthur - Date: 2024-01-15, Attendees: John, Sarah, Mike...",
  },
  {
    id: "2024-01-12-api-changes",
    projectId: "slskey",
    workspaceId: "slsp",
    filePath: "~/Orbit/workspaces/slsp/projects/slskey/docs/2024-01-12-api-changes.md",
    title: "API v2 Changes Summary",
    created: "2024-01-12",
    content: "# API v2 Changes Summary\n\n## Breaking Changes\n- Authentication endpoint moved to `/auth/v2`\n- Response format changed to JSON:API spec\n- Rate limiting now 100 req/min\n\n## New Features\n- Batch operations support\n- Webhook callbacks\n- GraphQL endpoint (beta)\n\n## Migration Guide\nSee docs at `/docs/migration-v2`",
    preview: "API v2 Changes Summary - Breaking Changes: Authentication endpoint moved...",
  },
  {
    id: "2024-01-10-alma-kickoff",
    projectId: "alma-migration",
    workspaceId: "slsp",
    filePath: "~/Orbit/workspaces/slsp/projects/alma-migration/docs/2024-01-10-alma-kickoff.md",
    title: "Alma Migration Kickoff",
    created: "2024-01-10",
    content: "# Alma Migration Kickoff\n\n## Project Overview\nMigrating from legacy system to Ex Libris Alma.\n\n## Timeline\n- Phase 1: Data mapping (Jan-Feb)\n- Phase 2: Test migration (Mar)\n- Phase 3: Production migration (Apr)\n\n## Team\n- Lead: Maria\n- Technical: Alex, Chris\n- Support: Lisa",
    preview: "Alma Migration Kickoff - Project Overview: Migrating from legacy system to Ex Libris Alma...",
  },
];

// ============================================================================
// MEETINGS
// ============================================================================

export const mockMeetings: Meeting[] = [
  {
    id: "2024-01-15-weekly-sync",
    projectId: "slskey",
    workspaceId: "slsp",
    filePath: "~/Orbit/workspaces/slsp/projects/slskey/meetings/2024-01-15-weekly-sync.md",
    title: "Weekly Sync",
    date: "2024-01-15",
    created: "2024-01-15",
    attendees: ["Sascha", "Maria", "Thomas"],
    content: "# Weekly Sync\n\n## Attendees\n- Sascha\n- Maria\n- Thomas\n\n## Agenda\n1. Review last week's progress\n2. Blockers and issues\n3. Plan for this week\n\n## Notes\n- Webhook integration is on track\n- Need to follow up with ZB Winterthur on API credentials\n- Security review scheduled for Friday\n\n## Action Items\n- [ ] Sascha: Finish webhook endpoint\n- [ ] Maria: Send security requirements doc\n- [ ] Thomas: Update project timeline",
    preview: "Weekly Sync - Review last week's progress, blockers, plan for this week...",
  },
  {
    id: "2024-01-12-kickoff-zb-winterthur",
    projectId: "slskey",
    workspaceId: "slsp",
    filePath: "~/Orbit/workspaces/slsp/projects/slskey/meetings/2024-01-12-kickoff-zb-winterthur.md",
    title: "ZB Winterthur Kickoff",
    date: "2024-01-12",
    created: "2024-01-12",
    attendees: ["Sascha", "John (ZB)", "Sarah (ZB)"],
    content: "# ZB Winterthur Kickoff\n\n## Attendees\n- Sascha (SLSP)\n- John (ZB Winterthur)\n- Sarah (ZB Winterthur)\n\n## Purpose\nKickoff meeting for SLSKey integration with ZB Winterthur library.\n\n## Discussion\n- Overview of SLSKey authentication system\n- Technical requirements and integration timeline\n- Go-live target: End of February\n\n## Decisions\n- Will use webhook-based integration\n- Security audit required before go-live\n- Weekly status updates via email\n\n## Next Steps\n- [ ] SLSP to provide API documentation\n- [ ] ZB to share their current auth system details\n- [ ] Schedule technical deep-dive for next week",
    preview: "ZB Winterthur Kickoff - Kickoff meeting for SLSKey integration...",
  },
  {
    id: "2024-01-08-sprint-planning",
    projectId: "slskey",
    workspaceId: "slsp",
    filePath: "~/Orbit/workspaces/slsp/projects/slskey/meetings/2024-01-08-sprint-planning.md",
    title: "Sprint Planning - January",
    date: "2024-01-08",
    created: "2024-01-08",
    attendees: ["Sascha", "Maria", "Alex"],
    content: "# Sprint Planning - January\n\n## Sprint Goal\nComplete ZB Winterthur integration foundation.\n\n## Planned Work\n1. Webhook endpoint setup (8 points)\n2. Authentication flow updates (5 points)\n3. Documentation updates (3 points)\n4. Security review preparation (5 points)\n\n## Capacity\n- Sascha: 80%\n- Maria: 60%\n- Alex: 100%\n\n## Risks\n- Dependency on ZB providing credentials\n- Potential security review delays",
    preview: "Sprint Planning - January - Complete ZB Winterthur integration foundation...",
  },
  {
    id: "2024-01-10-data-mapping-review",
    projectId: "alma-migration",
    workspaceId: "slsp",
    filePath: "~/Orbit/workspaces/slsp/projects/alma-migration/meetings/2024-01-10-data-mapping-review.md",
    title: "Data Mapping Review",
    date: "2024-01-10",
    created: "2024-01-10",
    attendees: ["Sascha", "Lisa", "Chris"],
    content: "# Data Mapping Review\n\n## Purpose\nReview initial data mapping between legacy system and Alma.\n\n## Key Findings\n- 85% of fields have direct mapping\n- 10% need transformation logic\n- 5% have no equivalent (need decisions)\n\n## Problem Fields\n- Custom patron categories\n- Historical loan data format\n- Legacy barcode formats\n\n## Decisions\n- Transform patron categories to Alma user groups\n- Archive historical data separately\n- Create barcode migration script\n\n## Next Meeting\nScheduled for Jan 17 to review transformation logic",
    preview: "Data Mapping Review - Review initial data mapping between legacy system and Alma...",
  },
];
