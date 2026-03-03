
import { useState, useCallback, useEffect, useRef } from "react";
import { isTauri } from "@/lib/desk";

type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "error";

interface UpdateInfo {
  version: string;
  date?: string;
}

export function useUpdateChecker() {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updateRef = useRef<Awaited<ReturnType<typeof import("@tauri-apps/plugin-updater").check>> | null>(null);

  const checkForUpdate = useCallback(async (manual = false) => {
    if (!isTauri()) return;

    setStatus("checking");
    setError(null);

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      console.log("[Update] Checking for updates...");
      const update = await check();

      if (update) {
        console.log("[Update] Update available:", {
          version: update.version,
          date: update.date,
          currentVersion: update.currentVersion,
        });
        updateRef.current = update;
        setUpdateInfo({
          version: update.version,
          date: update.date,
        });
        setStatus("available");
        return true;
      } else {
        console.log("[Update] No updates available");
        setStatus("idle");
        return false;
      }
    } catch (err) {
      console.error("[Update] Check failed:", err);
      console.error("[Update] Error details:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
      // Only show error in UI when manually triggered
      if (manual) {
        setError(err instanceof Error ? err.message : "Update check failed");
        setStatus("error");
      } else {
        setStatus("idle");
      }
      return false;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    setStatus("downloading");
    setError(null);

    try {
      console.log("[Update] Starting download and install...");
      console.log("[Update] Update details:", {
        version: update.version,
        date: update.date,
        currentVersion: update.currentVersion,
      });

      await update.downloadAndInstall();

      console.log("[Update] Download and install completed, relaunching...");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      console.error("[Update] Install failed:", err);
      console.error("[Update] Error type:", typeof err);
      console.error("[Update] Error details:", JSON.stringify(err, Object.getOwnPropertyNames(err)));

      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[Update] Error message:", errorMessage);

      setError(errorMessage || "Update install failed");
      setStatus("error");
    }
  }, []);

  const dismiss = useCallback(() => {
    setStatus("idle");
    setUpdateInfo(null);
    updateRef.current = null;
  }, []);

  // Auto-check 5s after mount
  const hasChecked = useRef(false);
  useEffect(() => {
    if (hasChecked.current || !isTauri()) return;
    hasChecked.current = true;

    const timer = setTimeout(() => {
      checkForUpdate();
    }, 5000);

    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  return {
    status,
    updateInfo,
    error,
    checkForUpdate,
    downloadAndInstall,
    dismiss,
  };
}
