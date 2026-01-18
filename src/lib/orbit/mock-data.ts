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

import type { Area, Project, Task, Note } from "@/types";

// ============================================================================
// AREAS
// ============================================================================

export const mockAreas: Area[] = [
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
    areaId: "slsp",
    name: "SLSKey",
    status: "active",
    description: "Swiss Library Service Key authentication system",
    created: "2024-01-01",
    taskCount: 4,
    tasksByStatus: { todo: 1, doing: 2, done: 1 },
  },
  {
    id: "alma-migration",
    areaId: "slsp",
    name: "Alma Migration",
    status: "active",
    description: "Migration of library data to Ex Libris Alma",
    created: "2024-01-05",
    taskCount: 1,
    tasksByStatus: { todo: 1, doing: 0, done: 0 },
  },
  {
    id: "api-v2",
    areaId: "slsp",
    name: "API v2",
    status: "paused",
    description: "Next generation REST API",
    created: "2023-11-15",
    taskCount: 0,
    tasksByStatus: { todo: 0, doing: 0, done: 0 },
  },
  {
    id: "main",
    areaId: "sss",
    name: "Main Project",
    status: "active",
    description: "Primary SSS development work",
    created: "2024-01-10",
    taskCount: 0,
    tasksByStatus: { todo: 0, doing: 0, done: 0 },
  },
];

// ============================================================================
// TASKS
// ============================================================================

export const mockTasks: Task[] = [
  {
    id: "2024-01-15-setup-webhook",
    projectId: "slskey",
    areaId: "slsp",
    filePath: "~/Orbit/areas/slsp/projects/slskey/tasks/2024-01-15-setup-webhook.md",
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
    areaId: "slsp",
    filePath: "~/Orbit/areas/slsp/projects/slskey/tasks/2024-01-14-review-docs.md",
    title: "Review API documentation",
    status: "todo",
    priority: "medium",
    created: "2024-01-14",
    content: "Go through the updated API docs and note any breaking changes.",
  },
  {
    id: "2024-01-13-fix-auth-bug",
    projectId: "slskey",
    areaId: "slsp",
    filePath: "~/Orbit/areas/slsp/projects/slskey/tasks/2024-01-13-fix-auth-bug.md",
    title: "Fix authentication timeout bug",
    status: "done",
    priority: "high",
    created: "2024-01-13",
    content: "Users getting logged out after 5 minutes. Need to increase token lifetime.",
  },
  {
    id: "2024-01-12-write-specs",
    projectId: "alma-migration",
    areaId: "slsp",
    filePath: "~/Orbit/areas/slsp/projects/alma-migration/tasks/2024-01-12-write-specs.md",
    title: "Write migration specs",
    status: "todo",
    priority: "low",
    created: "2024-01-12",
    content: "Document the data migration process for Alma.",
  },
  {
    id: "2024-01-11-email-followup",
    projectId: "slskey",
    areaId: "slsp",
    filePath: "~/Orbit/areas/slsp/projects/slskey/tasks/2024-01-11-email-followup.md",
    title: "Email follow-up with library",
    status: "doing",
    created: "2024-01-11",
    content: "Follow up on the integration timeline.",
  },
];

// ============================================================================
// NOTES
// ============================================================================

export const mockNotes: Note[] = [
  {
    id: "2024-01-15-meeting-zb-winterthur",
    projectId: "slskey",
    areaId: "slsp",
    filePath: "~/Orbit/areas/slsp/projects/slskey/notes/2024-01-15-meeting-zb-winterthur.md",
    title: "Meeting with ZB Winterthur",
    created: "2024-01-15",
    content: "# Meeting with ZB Winterthur\n\n**Date:** 2024-01-15\n**Attendees:** John, Sarah, Mike\n\n## Agenda\n- Discuss webhook integration\n- Review timeline\n- Address security concerns\n\n## Notes\nThey want to go live by end of February. Need to prioritize the webhook setup.\n\n## Action Items\n- [ ] Send API documentation\n- [ ] Schedule follow-up call\n- [ ] Prepare security audit report",
    preview: "Meeting with ZB Winterthur - Date: 2024-01-15, Attendees: John, Sarah, Mike...",
  },
  {
    id: "2024-01-12-api-changes",
    projectId: "slskey",
    areaId: "slsp",
    filePath: "~/Orbit/areas/slsp/projects/slskey/notes/2024-01-12-api-changes.md",
    title: "API v2 Changes Summary",
    created: "2024-01-12",
    content: "# API v2 Changes Summary\n\n## Breaking Changes\n- Authentication endpoint moved to `/auth/v2`\n- Response format changed to JSON:API spec\n- Rate limiting now 100 req/min\n\n## New Features\n- Batch operations support\n- Webhook callbacks\n- GraphQL endpoint (beta)\n\n## Migration Guide\nSee docs at `/docs/migration-v2`",
    preview: "API v2 Changes Summary - Breaking Changes: Authentication endpoint moved...",
  },
  {
    id: "2024-01-10-alma-kickoff",
    projectId: "alma-migration",
    areaId: "slsp",
    filePath: "~/Orbit/areas/slsp/projects/alma-migration/notes/2024-01-10-alma-kickoff.md",
    title: "Alma Migration Kickoff",
    created: "2024-01-10",
    content: "# Alma Migration Kickoff\n\n## Project Overview\nMigrating from legacy system to Ex Libris Alma.\n\n## Timeline\n- Phase 1: Data mapping (Jan-Feb)\n- Phase 2: Test migration (Mar)\n- Phase 3: Production migration (Apr)\n\n## Team\n- Lead: Maria\n- Technical: Alex, Chris\n- Support: Lisa",
    preview: "Alma Migration Kickoff - Project Overview: Migrating from legacy system to Ex Libris Alma...",
  },
];
