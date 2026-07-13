/**
 * Planner store — week plans (Zustand, persisted) + cross-workspace tasks (TanStack Query)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useQuery } from "@tanstack/react-query";
import type { WeekPlan, WorkspaceBlock } from "@desk/core/types";
import { createRemoteSettingStorage } from "./remote-setting-storage";
import { getDeskService } from "@desk/core";

// ── Zustand store for week plans ────────────────────────────────────

interface PlannerState {
  weekPlans: Record<string, WeekPlan>; // Keyed by weekOf ISO date

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
  /** Set (or clear, with an empty string) one of the week's ≤3 intentions. */
  setIntention: (weekOf: string, index: number, text: string) => void;
}

/** Max intentions per week. Three is a focus; ten is a to-do list. */
export const MAX_INTENTIONS = 3;

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
    (set) => ({
      weekPlans: {},

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

      // One action covers add, edit and clear: writing at `index` then compacting means
      // a cleared slot makes the ones below it slide up, and the list never grows holes.
      setIntention: (weekOf, index, text) =>
        set((s) =>
          updatePlan(s, weekOf, (plan) => {
            const next = [...(plan.intentions ?? [])];
            next[index] = text.trim();
            const compact = next.filter(Boolean).slice(0, MAX_INTENTIONS);
            return { ...plan, intentions: compact.length ? compact : undefined };
          })
        ),
    }),
    {
      name: "planner-store",
      // User-level → shared across devices in hosted mode (.desk/settings/planner.json).
      storage: createRemoteSettingStorage<PlannerState>("planner"),
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
  allTasksAllStatuses: () =>
    [...plannerKeys.all, "allTasksAllStatuses"] as const,
};

/**
 * Every task, every status, every workspace — the planner's single task query.
 *
 * Blocks need done/backlog tasks too (a task finished after it was planned must stay
 * visible, struck through, rather than vanishing from the week), and the rail's set is a
 * plain filter of this one. Running a second, narrower query alongside it would mean two
 * filesystem scans and two independent staleness clocks that can disagree — long enough
 * for a task to sit in a block and in the rail at the same time.
 */
export function useAllWorkspaceTasksAllStatuses() {
  return useQuery({
    queryKey: plannerKeys.allTasksAllStatuses(),
    queryFn: () => getDeskService().getAllWorkspaceTasksAllStatuses(),
    staleTime: 30_000,
  });
}
