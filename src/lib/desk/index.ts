/**
 * Desk file system library — barrel export
 *
 * All CRUD operations, file system abstractions, and utilities
 * for the desk.md data model.
 */

// ── CRUD operations ─────────────────────────────────────────────────
export * from "./workspaces";
export * from "./projects";
export * from "./tasks";
export * from "./content";
export * from "./meetings";
export * from "./personal";

// ── File system & parsing ───────────────────────────────────────────
export * from "./tauri-fs";
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
