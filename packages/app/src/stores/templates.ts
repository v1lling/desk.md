import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_TEMPLATES, type TemplateType, type TemplatesConfig } from "@/lib/templates";
import { createRemoteSettingStorage } from "./remote-setting-storage";

interface TemplatesState {
  /** Global default templates (apply to all workspaces unless overridden) */
  global: TemplatesConfig;
  /** Per-workspace template overrides. Key = workspaceId */
  workspaces: Record<string, TemplatesConfig>;

  // Actions
  setGlobalTemplate: (type: TemplateType, body: string) => void;
  setWorkspaceTemplate: (workspaceId: string, type: TemplateType, body: string) => void;
  clearWorkspaceTemplate: (workspaceId: string, type: TemplateType) => void;

  /** Resolve template: workspace override > global > hardcoded default */
  getTemplate: (type: TemplateType, workspaceId: string) => string;
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => ({
      global: {},
      workspaces: {},

      setGlobalTemplate: (type, body) =>
        set((state) => ({
          global: { ...state.global, [type]: body },
        })),

      setWorkspaceTemplate: (workspaceId, type, body) =>
        set((state) => ({
          workspaces: {
            ...state.workspaces,
            [workspaceId]: { ...state.workspaces[workspaceId], [type]: body },
          },
        })),

      clearWorkspaceTemplate: (workspaceId, type) =>
        set((state) => {
          const ws = { ...state.workspaces[workspaceId] };
          delete ws[type];
          // Remove workspace entry entirely if no overrides left
          const workspaces = { ...state.workspaces };
          if (Object.keys(ws).length === 0) {
            delete workspaces[workspaceId];
          } else {
            workspaces[workspaceId] = ws;
          }
          return { workspaces };
        }),

      getTemplate: (type, workspaceId) => {
        const state = get();
        // 1. Workspace override
        const wsTemplate = state.workspaces[workspaceId]?.[type];
        if (wsTemplate !== undefined) return wsTemplate;
        // 2. Global override
        const globalTemplate = state.global[type];
        if (globalTemplate !== undefined) return globalTemplate;
        // 3. Hardcoded default
        return DEFAULT_TEMPLATES[type];
      },
    }),
    {
      name: "desk-templates",
      // User-level → shared across devices in hosted mode (.desk/settings/templates.json).
      storage: createRemoteSettingStorage<Pick<TemplatesState, "global" | "workspaces">>("templates"),
      partialize: (state) => ({
        global: state.global,
        workspaces: state.workspaces,
      }),
    }
  )
);
