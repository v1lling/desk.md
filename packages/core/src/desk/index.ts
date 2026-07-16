/**
 * Desk file system library — barrel export
 *
 * All CRUD operations, file system abstractions, and utilities
 * for the desk.md data model.
 */

// ── Domain operations (SEAM 2) ──────────────────────────────────────
// External callers reach domain CRUD via getDeskService() from ./service.
// The module-level functions below stay exported for use *inside* lib/desk
// (LocalDeskService binds them; aggregators like dashboard.ts call them directly).
export * from "./service";
export * from "./workspaces";
export * from "./projects";
export * from "./tasks";
export * from "./content";
export * from "./meetings";
export * from "./personal";

// ── File system & parsing ───────────────────────────────────────────
// env re-exports the platform checks (isTauri/isMacOS/needsTrafficLightPadding)
export * from "./env";
export * from "./storage";
export * from "./parser";
export * from "./constants";
export * from "./paths";
export * from "./tree-path";
export * from "./file-utils";
export * from "./file-operations";
export * from "./note-link";
export * from "./norms";

// ── Docs tree + queries + planner ───────────────────────────────────
export * from "./content-tree";
export * from "./context-freshness";
export * from "./project-brief";
export * from "./project-state";
export * from "./agent-queries";
export * from "./planner";

// ── Catalog (always-complete, AI-free metadata index) ───────────────
export * from "./catalog";

// ── AI (runtime-agnostic provider/service layer; key via injectable seam) ──
export * from "./ai";
export * from "./ai-usage";

// ── Maintenance engine (Smart Index + project state; runs where the data lives) ──
export * from "./maintenance";

// ── Search ──────────────────────────────────────────────────────────
export * from "./search";
export * from "./search-index";

// ── Computed / aggregated data ──────────────────────────────────────
export * from "./calculations";
export * from "./dashboard";
export * from "./view-state";
export * from "./settings";
export * from "./index-cache";
export * from "./aiignore";

// ── Injectable host seams (wired by app/server at boot) ─────────────
export * from "./data-root";
export * from "./editor-notifier";
export * from "./agent-context-writer";

// ── Pub/sub for editor sync (pure; wired to the watcher by the app) ──
export * from "./editor-event-bus";

// ── Domain-write bus + path classification (the maintenance trigger) ──
export * from "./domain-write-bus";
export * from "./path-identity";

// ── Infrastructure ──────────────────────────────────────────────────
// Note: the file watcher and the React file-tree hooks are UI/Tauri glue and
// live in the app (packages/app/src/lib), not core.
export * from "./file-cache";
