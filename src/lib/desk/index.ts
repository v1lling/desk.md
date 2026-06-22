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

// ── Search ──────────────────────────────────────────────────────────
export * from "./search";
export * from "./search-index";

// ── Computed / aggregated data ──────────────────────────────────────
export * from "./calculations";
export * from "./dashboard";
export * from "./view-state";

// ── Infrastructure ──────────────────────────────────────────────────
export * from "./watcher";
export * from "./file-cache";
