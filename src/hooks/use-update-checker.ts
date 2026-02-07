"use client";

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

  const checkForUpdate = useCallback(async () => {
    if (!isTauri()) return;

    setStatus("checking");
    setError(null);

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (update) {
        updateRef.current = update;
        setUpdateInfo({
          version: update.version,
          date: update.date,
        });
        setStatus("available");
        return true;
      } else {
        setStatus("idle");
        return false;
      }
    } catch (err) {
      console.error("[Update] Check failed:", err);
      setError(err instanceof Error ? err.message : "Update check failed");
      setStatus("error");
      return false;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    setStatus("downloading");
    setError(null);

    try {
      await update.downloadAndInstall();
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      console.error("[Update] Install failed:", err);
      setError(err instanceof Error ? err.message : "Update install failed");
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
