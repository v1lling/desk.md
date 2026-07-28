import { useEffect, useRef } from "react";
import {
  registerUnsavedChanges,
  unregisterUnsavedChanges,
} from "@/lib/unsaved-changes-guard";

/**
 * Protect an editing surface from browser unload and, by default, Desk's link,
 * project, and workspace navigation.
 */
export function useUnsavedChangesGuard(
  dirty: boolean,
  message: string,
  guardInAppNavigation = true,
  label = message,
): void {
  const source = useRef(Symbol("unsaved-changes"));

  useEffect(() => {
    const token = source.current;
    if (dirty) registerUnsavedChanges(token, message, label, guardInAppNavigation);
    else unregisterUnsavedChanges(token);
    return () => unregisterUnsavedChanges(token);
  }, [dirty, guardInAppNavigation, label, message]);

  useEffect(() => {
    if (!dirty) return;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [dirty]);
}
