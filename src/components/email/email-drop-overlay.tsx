import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { isTauri } from "@/lib/desk/env";
import { importEmlFromPath, isEmlPath } from "@/lib/email";
import { useTabStore } from "@/stores/tabs";

// Listens for two parallel drop sources and funnels both into the same import:
//
//   1. Tauri events `email-drag-{enter,leave,drop}` — emitted by drop_view.m
//      when an NSFilePromiseReceiver / namesOfPromisedFilesDroppedAtDestination
//      drop lands (Apple Mail, Outlook for Mac Legacy + New).
//   2. `getCurrentWebview().onDragDropEvent` — defensive fallback for any
//      direct file-URL drop that bypasses the native overlay. In practice
//      drop_view.m claims every URL pasteboard today and routes Finder /
//      Thunderbird drops through `desk-files-drag-*` into the docs tree, so
//      this branch is rarely hit. Kept in case macOS or Tauri behavior
//      shifts later.
export function EmailDropOverlay() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    const unlisteners: Array<() => void> = [];

    (async () => {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      const { listen } = await import("@tauri-apps/api/event");

      // Direct file-URL drops (Thunderbird, Finder)
      const webviewUnlisten = await getCurrentWebview().onDragDropEvent(
        (event) => {
          const payload = event.payload as {
            type: "enter" | "over" | "leave" | "drop";
            paths?: string[];
          };

          if (payload.type === "enter" || payload.type === "over") {
            const paths = payload.paths ?? [];
            if (paths.some(isEmlPath)) setVisible(true);
          } else if (payload.type === "leave") {
            setVisible(false);
          } else if (payload.type === "drop") {
            setVisible(false);
            const emlPaths = (payload.paths ?? []).filter(isEmlPath);
            if (emlPaths.length === 0) return;
            void handleDroppedEmlPaths(emlPaths, "direct");
          }
        },
      );

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
        void handleDroppedEmlPaths([path], "promise");
      });

      if (disposed) {
        webviewUnlisten();
        enterUnlisten();
        leaveUnlisten();
        dropUnlisten();
      } else {
        unlisteners.push(
          webviewUnlisten,
          enterUnlisten,
          leaveUnlisten,
          dropUnlisten,
        );
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

async function handleDroppedEmlPaths(
  paths: string[],
  origin: "direct" | "promise",
) {
  const { openTab } = useTabStore.getState();
  for (const path of paths) {
    try {
      const email = await importEmlFromPath(path);
      openTab({
        type: "email",
        title: email.subject || i18n.t("entities.email.defaultTitle"),
        emailData: email,
      });
    } catch (error) {
      console.error("[email-drop] Failed to import .eml:", path, error);
      toast.error(i18n.t("errors.email.openFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Promise-based drops land in our app-owned temp dir; clean up.
      // Direct drops are files the user owns elsewhere — leave alone.
      if (origin === "promise") {
        try {
          await invoke("delete_dropped_file", { path });
        } catch {
          // Non-fatal; OS cleans /var/folders eventually.
        }
      }
    }
  }
}
