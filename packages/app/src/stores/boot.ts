import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Where the native app runs the domain (step 3b-native):
 *   - "local"  → in-process on the Mac filesystem (default; the only mode pre-3b-native)
 *   - "remote" → thin client of a deployed desk.md server (RemoteDeskService over HTTP)
 * This is a client-side setting, independent of `dataPath`/`setupCompleted`, so switching
 * back to local never disturbs the local setup and never traps the user behind a login.
 */
export type ConnectionMode = "local" | "remote";

interface BootState {
  dataPath: string;
  setupCompleted: boolean;
  connectionMode: ConnectionMode;
  /** Base URL of the remote server when connectionMode === "remote" (e.g. https://nas.example). */
  serverUrl: string;
  setDataPath: (path: string) => void;
  setSetupCompleted: (completed: boolean) => void;
  setConnection: (mode: ConnectionMode, serverUrl?: string) => void;
  reset: () => void;
}

const getDefaultDataPath = (): string => {
  if (typeof window !== "undefined") {
    return "~/Desk";
  }
  return "";
};

const defaultBoot = {
  dataPath: getDefaultDataPath(),
  setupCompleted: false,
  connectionMode: "local" as ConnectionMode,
  serverUrl: "",
};

export const useBootStore = create<BootState>()(
  persist(
    (set) => ({
      ...defaultBoot,
      setDataPath: (path) => set({ dataPath: path }),
      setSetupCompleted: (completed) => set({ setupCompleted: completed }),
      setConnection: (mode, serverUrl) =>
        set((state) => ({
          connectionMode: mode,
          serverUrl: mode === "remote" ? (serverUrl ?? state.serverUrl) : state.serverUrl,
        })),
      reset: () => set(defaultBoot),
    }),
    {
      name: "desk-boot",
      partialize: (state) => ({
        dataPath: state.dataPath,
        setupCompleted: state.setupCompleted,
        connectionMode: state.connectionMode,
        serverUrl: state.serverUrl,
      }),
    }
  )
);
