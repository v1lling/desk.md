/**
 * Planner store — week plans (Zustand, persisted) + cross-workspace tasks (TanStack Query)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useQuery } from "@tanstack/react-query";
import type { WeekPlan, WorkspaceBlock } from "@desk/core/types";
import { createFileStorage } from "./file-storage";
import { getDeskService } from "@desk/core";

// ── Zustand store for week plans ────────────────────────────────────

interface PlannerState {
  weekPlans: Record<string, WeekPlan>; // Keyed by weekOf ISO date

  getOrCreateWeekPlan: (weekOf: string) => WeekPlan;
  addBlock: (weekOf: string, day: string, block: WorkspaceBlock) => void;
  removeBlock: (weekOf: string, day: string, blockId: string) => void;
  updateBlock: (
    weekOf: string,
    day: string,
    blockId: string,
    updates: Partial<Pick<WorkspaceBlock, "notes">>
  ) => void;
  addNoteToBlock: (
    weekOf: string,
    day: string,
    blockId: string,
    note: string
  ) => void;
  removeNoteFromBlock: (
    weekOf: string,
    day: string,
    blockId: string,
    noteIndex: number
  ) => void;
  updateNoteInBlock: (
    weekOf: string,
    day: string,
    blockId: string,
    noteIndex: number,
    text: string
  ) => void;
  updateBlockTime: (
    weekOf: string,
    day: string,
    blockId: string,
    startMinute: number,
    endMinute: number
  ) => void;
  moveBlock: (
    weekOf: string,
    fromDay: string,
    toDay: string,
    blockId: string,
    startMinute: number
  ) => void;
  addTaskToBlock: (
    weekOf: string,
    day: string,
    blockId: string,
    taskId: string
  ) => void;
  removeTaskFromBlock: (
    weekOf: string,
    day: string,
    blockId: string,
    taskId: string
  ) => void;
  moveTask: (
    weekOf: string,
    fromDay: string,
    fromBlockId: string,
    toDay: string,
    toBlockId: string,
    taskId: string
  ) => void;
}

/** Migrate old string notes to string[] format on rehydration */
function normalizeBlockNotes(block: WorkspaceBlock): WorkspaceBlock {
  if (typeof block.notes === "string") {
    const parts = (block.notes as unknown as string).split("\n").filter(Boolean);
    return { ...block, notes: parts.length > 0 ? parts : undefined };
  }
  return block;
}

function emptyWeekPlan(weekOf: string): WeekPlan {
  return { weekOf, days: {} };
}

function updateDayBlocks(
  plan: WeekPlan,
  day: string,
  updater: (blocks: WorkspaceBlock[]) => WorkspaceBlock[]
): WeekPlan {
  return {
    ...plan,
    days: {
      ...plan.days,
      [day]: updater(plan.days[day] || []),
    },
  };
}

function updatePlan(
  state: PlannerState,
  weekOf: string,
  updater: (plan: WeekPlan) => WeekPlan
): Partial<PlannerState> {
  const plan = state.weekPlans[weekOf] || emptyWeekPlan(weekOf);
  return {
    weekPlans: { ...state.weekPlans, [weekOf]: updater(plan) },
  };
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      weekPlans: {},

      getOrCreateWeekPlan: (weekOf) => {
        const existing = get().weekPlans[weekOf];
        if (existing) return existing;
        const plan = emptyWeekPlan(weekOf);
        set((s) => ({ weekPlans: { ...s.weekPlans, [weekOf]: plan } }));
        return plan;
      },

      addBlock: (weekOf, day, block) =>
        set((s) =>
          updatePlan(s, weekOf, (plan) =>
            updateDayBlocks(plan, day, (blocks) => [...blocks, block])
          )
        ),

      removeBlock: (weekOf, day, blockId) =>
        set((s) =>
          updatePlan(s, weekOf, (plan) =>
            updateDayBlocks(plan, day, (blocks) =>
              blocks.filter((b) => b.id !== blockId)
            )
          )
        ),

      updateBlock: (weekOf, day, blockId, updates) =>
        set((s) =>
          updatePlan(s, weekOf, (plan) =>
            updateDayBlocks(plan, day, (blocks) =>
              blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b))
            )
          )
        ),

      addNoteToBlock: (weekOf, day, blockId, note) =>
        set((s) =>
          updatePlan(s, weekOf, (plan) =>
            updateDayBlocks(plan, day, (blocks) =>
              blocks.map((b) =>
                b.id === blockId
                  ? { ...b, notes: [...(b.notes || []), note] }
                  : b
              )
            )
          )
        ),

      removeNoteFromBlock: (weekOf, day, blockId, noteIndex) =>
        set((s) =>
          updatePlan(s, weekOf, (plan) =>
            updateDayBlocks(plan, day, (blocks) =>
              blocks.map((b) => {
                if (b.id !== blockId || !b.notes) return b;
                const newNotes = b.notes.filter((_, i) => i !== noteIndex);
                return { ...b, notes: newNotes.length > 0 ? newNotes : undefined };
              })
            )
          )
        ),

      updateNoteInBlock: (weekOf, day, blockId, noteIndex, text) =>
        set((s) =>
          updatePlan(s, weekOf, (plan) =>
            updateDayBlocks(plan, day, (blocks) =>
              blocks.map((b) => {
                if (b.id !== blockId || !b.notes) return b;
                const newNotes = [...b.notes];
                newNotes[noteIndex] = text;
                return { ...b, notes: newNotes };
              })
            )
          )
        ),

      updateBlockTime: (weekOf, day, blockId, startMinute, endMinute) =>
        set((s) =>
          updatePlan(s, weekOf, (plan) =>
            updateDayBlocks(plan, day, (blocks) =>
              blocks.map((b) =>
                b.id === blockId ? { ...b, startMinute, endMinute } : b
              )
            )
          )
        ),

      moveBlock: (weekOf, fromDay, toDay, blockId, startMinute) =>
        set((s) => {
          const plan = s.weekPlans[weekOf] || emptyWeekPlan(weekOf);
          const fromBlocks = plan.days[fromDay] || [];
          const block = fromBlocks.find((b) => b.id === blockId);
          if (!block) return s;

          const duration = block.endMinute - block.startMinute;
          const movedBlock = {
            ...block,
            startMinute,
            endMinute: startMinute + duration,
          };

          let updated = updateDayBlocks(plan, fromDay, (blocks) =>
            blocks.filter((b) => b.id !== blockId)
          );

          updated = updateDayBlocks(updated, toDay, (blocks) => [
            ...blocks,
            movedBlock,
          ]);

          return {
            weekPlans: { ...s.weekPlans, [weekOf]: updated },
          };
        }),

      addTaskToBlock: (weekOf, day, blockId, taskId) =>
        set((s) =>
          updatePlan(s, weekOf, (plan) =>
            updateDayBlocks(plan, day, (blocks) =>
              blocks.map((b) =>
                b.id === blockId && !b.taskIds.includes(taskId)
                  ? { ...b, taskIds: [...b.taskIds, taskId] }
                  : b
              )
            )
          )
        ),

      removeTaskFromBlock: (weekOf, day, blockId, taskId) =>
        set((s) =>
          updatePlan(s, weekOf, (plan) =>
            updateDayBlocks(plan, day, (blocks) =>
              blocks.map((b) =>
                b.id === blockId
                  ? { ...b, taskIds: b.taskIds.filter((id) => id !== taskId) }
                  : b
              )
            )
          )
        ),

      moveTask: (weekOf, fromDay, fromBlockId, toDay, toBlockId, taskId) =>
        set((s) => {
          const plan = s.weekPlans[weekOf] || emptyWeekPlan(weekOf);
          // Remove from source block
          let updated = updateDayBlocks(plan, fromDay, (blocks) =>
            blocks.map((b) =>
              b.id === fromBlockId
                ? { ...b, taskIds: b.taskIds.filter((id) => id !== taskId) }
                : b
            )
          );
          // Add to target block
          updated = updateDayBlocks(updated, toDay, (blocks) =>
            blocks.map((b) =>
              b.id === toBlockId && !b.taskIds.includes(taskId)
                ? { ...b, taskIds: [...b.taskIds, taskId] }
                : b
            )
          );
          return {
            weekPlans: { ...s.weekPlans, [weekOf]: updated },
          };
        }),

    }),
    {
      name: "planner-store",
      storage: createFileStorage<PlannerState>("planner", "weeks.json"),
      partialize: (state) => ({ weekPlans: state.weekPlans }) as PlannerState,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        for (const weekOf in state.weekPlans) {
          const plan = state.weekPlans[weekOf];
          for (const day in plan.days) {
            plan.days[day] = plan.days[day].map(normalizeBlockNotes);
          }
        }
      },
    }
  )
);

// ── TanStack Query for cross-workspace tasks ────────────────────────

export const plannerKeys = {
  all: ["planner"] as const,
  allTasks: () => [...plannerKeys.all, "allTasks"] as const,
  allTasksAllStatuses: () =>
    [...plannerKeys.all, "allTasksAllStatuses"] as const,
};

/**
 * Hook to fetch all plannable tasks (todo/doing/waiting) across all workspaces
 */
export function useAllWorkspaceTasks() {
  return useQuery({
    queryKey: plannerKeys.allTasks(),
    queryFn: () => getDeskService().getAllWorkspaceTasks(),
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch ALL tasks across all workspaces (all statuses including backlog/done)
 */
export function useAllWorkspaceTasksAllStatuses() {
  return useQuery({
    queryKey: plannerKeys.allTasksAllStatuses(),
    queryFn: () => getDeskService().getAllWorkspaceTasksAllStatuses(),
    staleTime: 30_000,
  });
}
