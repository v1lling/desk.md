import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { IncomingEmail } from "@/lib/email/types";

export type TabType = "orbit" | "doc" | "task" | "meeting" | "email";

export interface TabItem {
  id: string;
  type: TabType;
  entityId?: string;
  title: string;
  workspaceId?: string;
  projectId?: string;
  isDirty?: boolean;
  isPinned?: boolean;
  // Email-specific: session-only data (not persisted)
  emailData?: IncomingEmail;
}

interface TabState {
  tabs: TabItem[];
  activeTabId: string;

  // Actions
  openTab: (tab: Omit<TabItem, "id">) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<TabItem>) => void;
  setTabDirty: (tabId: string, isDirty: boolean) => void;
  closeAllExcept: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  // Queries
  getTabByEntityId: (type: TabType, entityId: string) => TabItem | undefined;
}

const ORBIT_TAB: TabItem = {
  id: "orbit",
  type: "orbit",
  title: "Orbit",
  isPinned: true,
};

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [ORBIT_TAB],
      activeTabId: "orbit",

      openTab: (newTab) => {
        const { tabs } = get();

        // Check if tab for this entity already exists (not for email tabs which are always new)
        if (newTab.type !== "orbit" && newTab.type !== "email" && newTab.entityId) {
          const existing = tabs.find(
            (t) => t.type === newTab.type && t.entityId === newTab.entityId
          );
          if (existing) {
            set({ activeTabId: existing.id });
            return;
          }
        }

        // Create new tab
        let id: string;
        if (newTab.type === "orbit") {
          id = "orbit";
        } else if (newTab.type === "email") {
          // Email tabs use timestamp for unique ID (session only)
          id = `email-${Date.now()}`;
        } else {
          id = `${newTab.type}-${newTab.entityId}`;
        }
        const tab: TabItem = { ...newTab, id };

        set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: id,
        }));
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get();
        const tab = tabs.find((t) => t.id === tabId);

        // Can't close pinned tabs
        if (!tab || tab.isPinned) return;

        const tabIndex = tabs.findIndex((t) => t.id === tabId);
        const newTabs = tabs.filter((t) => t.id !== tabId);

        // If closing active tab, activate the previous tab or the next one
        let newActiveId = activeTabId;
        if (activeTabId === tabId) {
          if (tabIndex > 0) {
            newActiveId = newTabs[tabIndex - 1].id;
          } else if (newTabs.length > 0) {
            newActiveId = newTabs[0].id;
          }
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveId,
        });
      },

      setActiveTab: (tabId) => {
        const { tabs } = get();
        if (tabs.some((t) => t.id === tabId)) {
          set({ activeTabId: tabId });
        }
      },

      updateTab: (tabId, updates) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, ...updates } : t
          ),
        }));
      },

      setTabDirty: (tabId, isDirty) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, isDirty } : t
          ),
        }));
      },

      closeAllExcept: (tabId) => {
        set((state) => ({
          tabs: state.tabs.filter((t) => t.id === tabId || t.isPinned),
          activeTabId: tabId,
        }));
      },

      closeOtherTabs: (tabId) => {
        set((state) => ({
          tabs: state.tabs.filter((t) => t.id === tabId || t.isPinned),
          activeTabId: tabId,
        }));
      },

      reorderTabs: (fromIndex, toIndex) => {
        set((state) => {
          const newTabs = [...state.tabs];
          // Don't allow moving pinned tabs or moving before pinned tabs
          const pinnedCount = newTabs.filter((t) => t.isPinned).length;
          if (fromIndex < pinnedCount || toIndex < pinnedCount) return state;

          const [removed] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, removed);
          return { tabs: newTabs };
        });
      },

      getTabByEntityId: (type, entityId) => {
        return get().tabs.find((t) => t.type === type && t.entityId === entityId);
      },
    }),
    {
      name: "orbit-tabs",
      partialize: (state) => ({
        // Filter out email tabs (session-only) and strip emailData
        tabs: state.tabs
          .filter((t) => t.type !== "email")
          .map(({ emailData, ...rest }) => rest),
        activeTabId: state.activeTabId === "orbit" || !state.activeTabId.startsWith("email-")
          ? state.activeTabId
          : "orbit",
      }),
    }
  )
);

// Helper hook for opening entity tabs
export function useOpenTab() {
  const openTab = useTabStore((state) => state.openTab);

  return {
    openDoc: (doc: { id: string; title: string; workspaceId: string; projectId?: string }) => {
      openTab({
        type: "doc",
        entityId: doc.id,
        title: doc.title,
        workspaceId: doc.workspaceId,
        projectId: doc.projectId,
      });
    },
    openTask: (task: { id: string; title: string; workspaceId: string; projectId?: string }) => {
      openTab({
        type: "task",
        entityId: task.id,
        title: task.title,
        workspaceId: task.workspaceId,
        projectId: task.projectId,
      });
    },
    openMeeting: (meeting: { id: string; title: string; workspaceId: string; projectId?: string }) => {
      openTab({
        type: "meeting",
        entityId: meeting.id,
        title: meeting.title,
        workspaceId: meeting.workspaceId,
        projectId: meeting.projectId,
      });
    },
    openOrbit: () => {
      useTabStore.getState().setActiveTab("orbit");
    },
    openEmail: (email: IncomingEmail) => {
      openTab({
        type: "email",
        title: email.subject || "Email",
        emailData: email,
      });
    },
  };
}
