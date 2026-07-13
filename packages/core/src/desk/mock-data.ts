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

import type {
  Workspace,
  Project,
  Task,
  Doc,
  Meeting,
  ProjectViewState,
} from "../types";

/**
 * ISO date (YYYY-MM-DD) offset from today by `days`. Keeps mock data fresh —
 * due dates and timestamps stay realistic no matter when the app is run, so
 * screenshots and dev sessions never show a board full of long-overdue tasks.
 */
function iso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ============================================================================
// WORKSPACES
// ============================================================================

export const mockWorkspaces: Workspace[] = [
  {
    id: "personal",
    name: "Personal",
    description: "Private tasks, docs, and projects",
    color: "#6366f1",
    created: iso(-420),
    isHome: true,
  },
  {
    id: "acme",
    name: "Acme Co",
    description: "Client work for Acme Co",
    color: "#3b82f6",
    created: iso(-180),
  },
  {
    id: "side-projects",
    name: "Side Projects",
    description: "Personal side projects and experiments",
    color: "#10b981",
    created: iso(-300),
  },
];

// ============================================================================
// PROJECTS
//
// In browser mock mode, project stats (taskCount / tasksByStatus / docCount /
// meetingCount) are read straight from these fields — keep them in sync with
// the tasks / docs / meetings arrays below.
// ============================================================================

export const mockProjects: Project[] = [
  {
    id: "website-redesign",
    workspaceId: "acme",
    name: "Website Redesign",
    status: "active",
    description: "Redesign and rebuild the Acme Co marketing site",
    created: iso(-95),
    taskCount: 8,
    tasksByStatus: { backlog: 1, todo: 2, doing: 2, waiting: 1, done: 2 },
    docCount: 4,
    meetingCount: 3,
  },
  {
    id: "data-migration",
    workspaceId: "acme",
    name: "Data Migration",
    status: "active",
    description: "Migrate legacy CRM data to the new platform",
    created: iso(-70),
    taskCount: 5,
    tasksByStatus: { backlog: 0, todo: 2, doing: 1, waiting: 1, done: 1 },
    docCount: 2,
    meetingCount: 2,
  },
  {
    id: "api-v2",
    workspaceId: "acme",
    name: "API v2",
    status: "paused",
    description: "Next-generation REST API for partner integrations",
    created: iso(-140),
    taskCount: 3,
    tasksByStatus: { backlog: 1, todo: 1, doing: 0, waiting: 1, done: 0 },
    docCount: 1,
    meetingCount: 0,
  },
  {
    id: "brand-refresh",
    workspaceId: "acme",
    name: "Brand Refresh",
    status: "completed",
    description: "New brand system: logo lockups, palette, and typography",
    created: iso(-160),
    taskCount: 3,
    tasksByStatus: { backlog: 0, todo: 0, doing: 0, waiting: 0, done: 3 },
    docCount: 1,
    meetingCount: 1,
  },
  {
    id: "home-admin",
    workspaceId: "personal",
    name: "Home Admin",
    status: "active",
    description: "Personal admin: taxes, renewals, and appointments",
    created: iso(-250),
    taskCount: 4,
    tasksByStatus: { backlog: 0, todo: 2, doing: 1, waiting: 0, done: 1 },
    docCount: 0,
    meetingCount: 0,
  },
  {
    id: "pixel-weather",
    workspaceId: "side-projects",
    name: "Pixel Weather",
    status: "active",
    description: "A tiny, local-first weather app with a pixel-art radar",
    created: iso(-120),
    taskCount: 4,
    tasksByStatus: { backlog: 1, todo: 1, doing: 1, waiting: 0, done: 1 },
    docCount: 1,
    meetingCount: 0,
  },
  {
    id: "devblog",
    workspaceId: "side-projects",
    name: "Dev Blog",
    status: "paused",
    description: "Personal blog, writing up things I build",
    created: iso(-200),
    taskCount: 2,
    tasksByStatus: { backlog: 0, todo: 1, doing: 0, waiting: 1, done: 0 },
    docCount: 0,
    meetingCount: 0,
  },
];

// ============================================================================
// TASKS
// ============================================================================

const t = (
  id: string,
  workspaceId: string,
  projectId: string,
  dir: string,
  fields: Omit<Task, "id" | "workspaceId" | "projectId" | "filePath">
): Task => ({
  id,
  workspaceId,
  projectId,
  filePath: `~/Desk/workspaces/${workspaceId}/${dir}/tasks/${id}.md`,
  ...fields,
});

export const mockTasks: Task[] = [
  // --- Acme · Website Redesign ---------------------------------------------
  t("contact-form-endpoint", "acme", "website-redesign", "projects/website-redesign", {
    title: "Set up the contact form endpoint",
    status: "doing",
    priority: "medium",
    due: iso(2),
    created: iso(-6),
    content:
      "Wire up the contact form on the new site.\n\n## Steps\n- [x] Get API credentials\n- [ ] Configure the endpoint\n- [ ] Test with a sample submission",
  }),
  t("analytics-events", "acme", "website-redesign", "projects/website-redesign", {
    title: "Wire up analytics events",
    status: "doing",
    created: iso(-4),
    content: "Add page-view and conversion events for the new marketing pages.",
  }),
  t("pricing-page", "acme", "website-redesign", "projects/website-redesign", {
    title: "Build the new pricing page",
    status: "todo",
    priority: "medium",
    due: iso(5),
    created: iso(-3),
    content: "Three-tier pricing layout with a monthly/annual toggle.",
  }),
  t("review-api-docs", "acme", "website-redesign", "projects/website-redesign", {
    title: "Review API documentation for breaking changes",
    status: "todo",
    created: iso(-2),
    content: "Go through the updated API docs and note anything that affects the site.",
  }),
  t("final-copy", "acme", "website-redesign", "projects/website-redesign", {
    title: "Get final copy from the client",
    status: "waiting",
    created: iso(-5),
    content: "Blocked until Acme's marketing lead signs off on the homepage copy.",
  }),
  t("dark-mode-toggle", "acme", "website-redesign", "projects/website-redesign", {
    title: "Add a dark-mode toggle",
    status: "backlog",
    priority: "low",
    created: iso(-1),
    content: "Nice-to-have once the core pages ship.",
  }),
  t("fix-auth-timeout", "acme", "website-redesign", "projects/website-redesign", {
    title: "Fix authentication timeout bug",
    status: "done",
    priority: "medium",
    created: iso(-12),
    content: "Users were getting logged out after 5 minutes. Token lifetime increased.",
  }),
  t("hero-section", "acme", "website-redesign", "projects/website-redesign", {
    title: "Migrate the hero section to the new layout",
    status: "done",
    priority: "medium",
    created: iso(-14),
    content: "Rebuilt the hero with the new grid system.",
  }),

  // --- Acme · Data Migration -----------------------------------------------
  t("transformation-logic", "acme", "data-migration", "projects/data-migration", {
    title: "Write transformation logic for customer categories",
    status: "todo",
    priority: "low",
    due: iso(7),
    created: iso(-4),
    content: "Map legacy customer categories onto the new platform's group model.",
  }),
  t("migration-runbook", "acme", "data-migration", "projects/data-migration", {
    title: "Document the migration runbook",
    status: "todo",
    priority: "low",
    created: iso(-2),
    content: "Step-by-step runbook for the production cutover.",
  }),
  t("id-migration-script", "acme", "data-migration", "projects/data-migration", {
    title: "Build the ID migration script",
    status: "doing",
    priority: "low",
    created: iso(-3),
    content: "Translate legacy ID formats to the new platform's UUIDs.",
  }),
  t("read-replica-access", "acme", "data-migration", "projects/data-migration", {
    title: "Awaiting read-replica access to the legacy DB",
    status: "waiting",
    priority: "medium",
    created: iso(-6),
    content: "Ops ticket open. Need read access before the test migration can run.",
  }),
  t("map-legacy-fields", "acme", "data-migration", "projects/data-migration", {
    title: "Map legacy fields to the new schema",
    status: "done",
    priority: "medium",
    created: iso(-15),
    content: "85% direct mapping, 10% needs transformation, 5% has no equivalent.",
  }),

  // --- Acme · API v2 --------------------------------------------------------
  t("openapi-spec", "acme", "api-v2", "projects/api-v2", {
    title: "Draft the OpenAPI spec",
    status: "todo",
    created: iso(-20),
    content: "First pass at the v2 schema for partner endpoints.",
  }),
  t("rate-limit-decision", "acme", "api-v2", "projects/api-v2", {
    title: "Decision needed: rate-limit strategy",
    status: "waiting",
    created: iso(-18),
    content: "Per-key vs per-IP limits. Waiting on a call with the platform team.",
  }),
  t("evaluate-graphql", "acme", "api-v2", "projects/api-v2", {
    title: "Evaluate a GraphQL endpoint",
    status: "backlog",
    priority: "low",
    created: iso(-22),
    content: "Spike: is GraphQL worth it for the partner use case?",
  }),

  // --- Acme · Brand Refresh (completed) ------------------------------------
  t("logo-lockups", "acme", "brand-refresh", "projects/brand-refresh", {
    title: "Finalize the logo lockups",
    status: "done",
    priority: "medium",
    created: iso(-150),
    content: "Horizontal, stacked, and icon-only lockups delivered.",
  }),
  t("palette-tokens", "acme", "brand-refresh", "projects/brand-refresh", {
    title: "Export the color palette as design tokens",
    status: "done",
    priority: "low",
    created: iso(-145),
    content: "Tokens exported for both light and dark themes.",
  }),
  t("brand-guidelines-pdf", "acme", "brand-refresh", "projects/brand-refresh", {
    title: "Deliver the brand guidelines PDF",
    status: "done",
    priority: "medium",
    created: iso(-130),
    content: "Final 24-page guidelines document handed off to the client.",
  }),

  // --- Acme · unassigned ---------------------------------------------------
  t("renew-ssl", "acme", "_unassigned", "_unassigned", {
    title: "Renew the SSL certificate",
    status: "todo",
    priority: "high",
    due: iso(3),
    created: iso(-2),
    content: "Auto-renew failed last cycle. Renew manually before it expires.",
  }),
  t("audit-third-party-scripts", "acme", "_unassigned", "_unassigned", {
    title: "Audit third-party scripts",
    status: "backlog",
    priority: "low",
    created: iso(-8),
    content: "List every external script and check what it actually needs.",
  }),

  // --- Personal · Home Admin ----------------------------------------------
  t("quarterly-taxes", "personal", "home-admin", "projects/home-admin", {
    title: "File quarterly taxes",
    status: "todo",
    priority: "medium",
    due: iso(9),
    created: iso(-5),
    content: "Pull invoices from this quarter and submit.",
  }),
  t("renew-passport", "personal", "home-admin", "projects/home-admin", {
    title: "Renew passport",
    status: "doing",
    priority: "medium",
    created: iso(-10),
    content: "Photos done. Application form left to submit.",
  }),
  t("dentist-appointment", "personal", "home-admin", "projects/home-admin", {
    title: "Book a dentist appointment",
    status: "todo",
    priority: "low",
    created: iso(-3),
    content: "Overdue for a checkup.",
  }),
  t("annual-insurance", "personal", "home-admin", "projects/home-admin", {
    title: "Pay the annual insurance",
    status: "done",
    priority: "medium",
    created: iso(-25),
    content: "Renewed for another year.",
  }),

  // --- Personal · unassigned ----------------------------------------------
  t("summer-trip", "personal", "_unassigned", "_unassigned", {
    title: "Plan the summer trip",
    status: "doing",
    priority: "low",
    created: iso(-7),
    content: "Shortlist destinations and rough out a budget.",
  }),

  // --- Side Projects · Pixel Weather --------------------------------------
  t("radar-overlay", "side-projects", "pixel-weather", "projects/pixel-weather", {
    title: "Implement the pixel-art radar overlay",
    status: "doing",
    priority: "medium",
    created: iso(-4),
    content: "Render precipitation tiles as a chunky pixel grid over the map.",
  }),
  t("location-search", "side-projects", "pixel-weather", "projects/pixel-weather", {
    title: "Add location search",
    status: "todo",
    priority: "medium",
    created: iso(-6),
    content: "Geocoding lookup with a small results dropdown.",
  }),
  t("home-screen-widget", "side-projects", "pixel-weather", "projects/pixel-weather", {
    title: "Home-screen widget",
    status: "backlog",
    priority: "low",
    created: iso(-9),
    content: "A small widget showing the current conditions.",
  }),
  t("ship-v1-testflight", "side-projects", "pixel-weather", "projects/pixel-weather", {
    title: "Ship v1.0 to TestFlight",
    status: "done",
    priority: "medium",
    created: iso(-30),
    content: "First build out to testers.",
  }),

  // --- Side Projects · Dev Blog -------------------------------------------
  t("tauri-migration-post", "side-projects", "devblog", "projects/devblog", {
    title: "Write up the Tauri migration post",
    status: "todo",
    priority: "low",
    created: iso(-11),
    content: "Notes from moving the app shell from Electron to Tauri.",
  }),
  t("review-feedback", "side-projects", "devblog", "projects/devblog", {
    title: "Address review feedback on the draft",
    status: "waiting",
    priority: "low",
    created: iso(-13),
    content: "Waiting on comments from a friend who proofreads.",
  }),
];

// ============================================================================
// DOCS
// ============================================================================

export const mockDocs: Doc[] = [
  {
    id: "project-brief",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/docs/project-brief.md",
    title: "Project Brief",
    created: iso(-95),
    content:
      "# Website Redesign: Project Brief\n\n## Goal\nRebuild the Acme Co marketing site on the new stack with a refreshed brand.\n\n## Scope\n- Homepage, pricing, and contact pages\n- New design system components\n- Working contact form with analytics\n\n## Out of scope\n- The customer portal (separate project)\n- Blog migration\n\n## Success looks like\nA faster, on-brand site live before the end of the quarter.",
    preview: "Rebuild the Acme Co marketing site on the new stack with a refreshed brand.",
  },
  {
    id: "content-inventory",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/docs/content-inventory.md",
    title: "Content Inventory",
    created: iso(-60),
    content:
      "# Content Inventory\n\n| Page | Status | Owner |\n|------|--------|-------|\n| Home | Draft | Client |\n| Pricing | Needs copy | Client |\n| Contact | Ready |  |\n| About | Ready |  |\n\nMost pages are ready. Pricing copy is the remaining blocker.",
    preview: "A page-by-page inventory of site content and who owns each piece.",
  },
  {
    id: "context-website",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/ai-docs/context-website.md",
    title: "Website Redesign context (AI-distilled)",
    created: iso(-30),
    content:
      "# Website Redesign context\n\nDistilled from kickoff meetings and email threads.\n\n## Stakeholders\n- Acme marketing lead: owns sign-off, targets an end-of-quarter go-live.\n\n## Outstanding risks\n- Final homepage copy still pending from the client.\n- Security review not yet scheduled.",
    preview: "Distilled from kickoff meetings and email threads.",
  },
  {
    id: "research-webhook-auth",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/ai-docs/research-webhook-auth.md",
    title: "Research: webhook auth approaches",
    created: iso(-28),
    content:
      "# Research: webhook auth approaches\n\nComparing HMAC-signed payloads vs. mTLS for the contact-form webhook.\n\n- **HMAC**: simple, no cert management, good enough here.\n- **mTLS**: stronger, but heavier to operate.\n\n**Recommendation:** HMAC-signed payloads with a rotating secret.",
    preview: "Comparing HMAC-signed payloads vs. mTLS for the contact-form webhook.",
  },
  {
    id: "migration-plan",
    projectId: "data-migration",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/data-migration/docs/migration-plan.md",
    title: "Migration Plan",
    created: iso(-68),
    content:
      "# Data Migration Plan\n\n## Phases\n1. **Mapping**: field-by-field mapping of legacy to new.\n2. **Test migration**: dry run against a staging copy.\n3. **Cutover**: production migration during a maintenance window.\n\n## Rollback\nKeep the legacy DB read-only for two weeks after cutover.",
    preview: "Field mapping, a staging dry run, then a production cutover.",
  },
  {
    id: "legacy-schema-notes",
    projectId: "data-migration",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/data-migration/ai-docs/legacy-schema-notes.md",
    title: "Legacy schema notes (AI-distilled)",
    created: iso(-40),
    content:
      "# Legacy schema notes\n\nThings worth remembering about the old CRM schema:\n\n- Customer categories are free-text, not an enum.\n- Transaction history uses a denormalized wide table.\n- IDs are sequential integers, not UUIDs.",
    preview: "Things worth remembering about the old CRM schema.",
  },
  {
    id: "api-v2-design-notes",
    projectId: "api-v2",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/api-v2/docs/api-v2-design-notes.md",
    title: "API v2 Design Notes",
    created: iso(-130),
    content:
      "# API v2: Design Notes\n\n## Principles\n- Resource-oriented, JSON:API response shape.\n- Versioned under `/v2`.\n- Cursor-based pagination.\n\n## Open questions\n- Rate-limit strategy (per-key vs per-IP).\n- Whether to expose a GraphQL endpoint.",
    preview: "Design principles and open questions for the v2 partner API.",
  },
  {
    id: "brand-guidelines",
    projectId: "brand-refresh",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/brand-refresh/docs/brand-guidelines.md",
    title: "Brand Guidelines",
    created: iso(-130),
    content:
      "# Acme Co: Brand Guidelines\n\n## Logo\nUse the horizontal lockup by default; icon-only for small sizes.\n\n## Color\nPrimary blue `#3b82f6`, near-black ink, generous white space.\n\n## Typography\nGeist for everything: semibold for headings, regular for body.",
    preview: "Logo usage, color, and typography for the refreshed Acme brand.",
  },
  {
    id: "radar-rendering-notes",
    projectId: "pixel-weather",
    workspaceId: "side-projects",
    filePath: "~/Desk/workspaces/side-projects/projects/pixel-weather/docs/radar-rendering-notes.md",
    title: "Radar Rendering Notes",
    created: iso(-20),
    content:
      "# Radar rendering notes\n\nDraw precipitation onto a canvas, then downsample hard to get the chunky pixel look. Cache tiles per zoom level.",
    preview: "Draw precipitation onto a canvas, then downsample for the pixel look.",
  },
];

// ============================================================================
// MEETINGS
// ============================================================================

export const mockMeetings: Meeting[] = [
  {
    id: "client-kickoff",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/meetings/client-kickoff.md",
    title: "Client Kickoff",
    date: iso(-90),
    created: iso(-90),
    content:
      "# Client Kickoff\n\n## Attendees\n- You\n- Alex (Acme)\n- Sam (Acme)\n\n## Purpose\nKick off the website redesign.\n\n## Discussion\n- Walked through the new site structure.\n- Agreed on a webhook-based contact-form integration.\n- Go-live target: end of the quarter.\n\n## Decisions\n- Webhook integration over a direct DB write.\n- Security review required before launch.\n- Weekly status updates by email.\n\n## Action Items\n- [ ] Send API documentation\n- [ ] Client to share current system details\n- [ ] Schedule a technical deep-dive",
    preview: "Kick off the website redesign: structure, integration, and timeline.",
  },
  {
    id: "design-review",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/meetings/design-review.md",
    title: "Design Review",
    date: iso(-21),
    created: iso(-21),
    content:
      "# Design Review\n\n## Attendees\n- You\n- Morgan (design)\n\n## Notes\n- Homepage hero approved.\n- Pricing page needs a clearer monthly/annual toggle.\n- Dark mode pushed to a follow-up.\n\n## Action Items\n- [ ] Revise the pricing layout\n- [ ] Hand off the hero to development",
    preview: "Homepage hero approved; pricing layout needs another pass.",
  },
  {
    id: "weekly-sync",
    projectId: "website-redesign",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/website-redesign/meetings/weekly-sync.md",
    title: "Weekly Sync",
    date: iso(-4),
    created: iso(-4),
    content:
      "# Weekly Sync\n\n## Attendees\n- You\n- Morgan\n- Taylor\n\n## Agenda\n1. Last week's progress\n2. Blockers\n3. This week's plan\n\n## Notes\n- Contact form integration is on track.\n- Still waiting on final homepage copy from the client.\n- Security review pencilled in for Friday.\n\n## Action Items\n- [ ] Finish the contact form endpoint\n- [ ] Chase the client for copy\n- [ ] Confirm the security review slot",
    preview: "Progress, blockers, and the plan for the week.",
  },
  {
    id: "data-mapping-review",
    projectId: "data-migration",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/data-migration/meetings/data-mapping-review.md",
    title: "Data Mapping Review",
    date: iso(-40),
    created: iso(-40),
    content:
      "# Data Mapping Review\n\n## Findings\n- 85% of fields map directly.\n- 10% need transformation logic.\n- 5% have no equivalent and need a decision.\n\n## Decisions\n- Transform legacy customer categories into the new group model.\n- Archive historical transactions separately.\n- Write an ID migration script.",
    preview: "Field-by-field mapping review between the legacy and new systems.",
  },
  {
    id: "cutover-planning",
    projectId: "data-migration",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/data-migration/meetings/cutover-planning.md",
    title: "Cutover Planning",
    date: iso(-9),
    created: iso(-9),
    content:
      "# Cutover Planning\n\n## Plan\n- Maintenance window: a Saturday night.\n- Freeze writes to the legacy system at the start.\n- Run the migration, verify, then flip DNS.\n\n## Risks\n- Read-replica access still pending.\n- Need a clear rollback signal.",
    preview: "Sequencing the production cutover and its rollback plan.",
  },
  {
    id: "brand-handoff",
    projectId: "brand-refresh",
    workspaceId: "acme",
    filePath: "~/Desk/workspaces/acme/projects/brand-refresh/meetings/brand-handoff.md",
    title: "Brand Handoff",
    date: iso(-130),
    created: iso(-130),
    content:
      "# Brand Handoff\n\n## Delivered\n- Logo lockups (horizontal, stacked, icon).\n- Color palette as design tokens.\n- 24-page brand guidelines PDF.\n\n## Notes\nEverything signed off. Project closed.",
    preview: "Final handoff of the refreshed Acme brand system.",
  },
];

// Derive a deterministic `updated` stamp for every mock entry (the `created`
// day at a fixed time), so recency ordering and the activity feed have data in
// browser mode. Mock CRUD operations overwrite it with the real save instant.
// Undated entries stay unstamped: they carry no recency signal, exactly like a
// file dropped into the tree from outside the app.
for (const task of mockTasks) if (task.created) task.updated = `${task.created}T09:00:00.000Z`;
for (const doc of mockDocs) if (doc.created) doc.updated = `${doc.created}T10:00:00.000Z`;
for (const meeting of mockMeetings) if (meeting.created) meeting.updated = `${meeting.created}T11:00:00.000Z`;

// ============================================================================
// VIEW STATE
//
// Per-workspace / per-project UI state that lives in `.view.json` on disk. In
// browser mock mode there is no filesystem, so `getViewState` returns these
// entries instead. Keyed by `workspaceId` or `workspaceId/projectId`.
// ============================================================================

export const mockViewState: Record<string, ProjectViewState> = {
  // A couple of Acme tasks highlighted "for focus" — surfaces a workspace-color
  // tint on the board and populates the dashboard Focus widget.
  acme: { highlightedTasks: ["review-api-docs", "contact-form-endpoint"] },
};
