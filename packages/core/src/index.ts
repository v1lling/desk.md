/**
 * @desk/core — the pure desk.md domain layer.
 *
 * Runs in-process (Tauri webview, browser dev) or on a server (Node), against a
 * pluggable StorageProvider. Contains zero UI / React / Zustand / Tauri-only
 * imports — the three runtime couplings (data root, editor notify, agent-context
 * write) are injectable seams wired by the host (app or server) at boot.
 */
export * from "./types";
export * from "./desk";
