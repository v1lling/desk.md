import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { isTauri } from "@desk/core";
import { importEmlFromPath } from "@/lib/email";
import { useTabStore } from "@/stores/tabs";

// Listens for the native email-drop events `email-drag-{enter,leave,drop}`
// emitted by drop_view.m when an NSFilePromiseReceiver /
// namesOfPromisedFilesDroppedAtDestination drop lands (Apple Mail, Outlook for
// Mac Legacy + New). The webview's own `onDragDropEvent` is intentionally not
// used: the window runs with `dragDropEnabled: false` so WKWebView delivers
// HTML5 drag-and-drop to the page (needed for the docs tree), and the native
// Cocoa overlay is the single source of truth for external email/file drops.
export function EmailDropOverlay() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    const unlisteners: Array<() => void> = [];

    (async () => {
      const { listen } = await import("@tauri-apps/api/event");

      // File-promise drops (Apple Mail, Outlook)
      const enterUnlisten = await listen("email-drag-enter", () =>
        setVisible(true),
      );
      const leaveUnlisten = await listen("email-drag-leave", () =>
        setVisible(false),
      );
      const dropUnlisten = await listen<string>("email-drag-drop", (event) => {
        setVisible(false);
        const path = event.payload;
        if (!path) return;
        void handleDroppedEmlPaths([path]);
      });

      if (disposed) {
        enterUnlisten();
        leaveUnlisten();
        dropUnlisten();
      } else {
        unlisteners.push(enterUnlisten, leaveUnlisten, dropUnlisten);
      }
    })();

    return () => {
      disposed = true;
      unlisteners.forEach((fn) => fn());
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center bg-primary/10 backdrop-blur-sm">
      <div className="m-6 flex h-[calc(100%-3rem)] w-[calc(100%-3rem)] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary text-primary">
        <Mail className="size-10" />
        <p className="text-lg font-medium">{t("email.dropOverlay.title")}</p>
        <p className="text-sm text-muted-foreground">
          {t("email.dropOverlay.subtitle")}
        </p>
      </div>
    </div>
  );
}

async function handleDroppedEmlPaths(paths: string[]) {
  const { openTab } = useTabStore.getState();
  for (const path of paths) {
    try {
      const email = await importEmlFromPath(path);
      openTab({
        type: "email",
        title: email.subject || i18n.t("tabs.emailDefault"),
        emailData: email,
      });
    } catch (error) {
      console.error("[email-drop] Failed to import .eml:", path, error);
      toast.error(i18n.t("errors.email.openFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Promise drops land in our app-owned temp dir; clean up.
      try {
        await invoke("delete_dropped_file", { path });
      } catch {
        // Non-fatal; OS cleans /var/folders eventually.
      }
    }
  }
}
