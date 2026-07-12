import { useCallback } from "react";
import { useOpenTab } from "@/stores/tabs";
import { findByTypeAndId } from "@desk/core";
import type { NoteLink } from "@desk/core";
import { toast } from "sonner";
import i18next from "i18next";

/**
 * Hook that resolves internal note links (desk:// URIs) and opens them in tabs.
 */
export function useInternalLinkHandler() {
  const { openTask, openDoc, openMeeting } = useOpenTab();

  return useCallback(
    (link: NoteLink) => {
      const item = findByTypeAndId(link.type, link.id);
      if (!item) {
        toast.error(i18next.t("toasts.link.notFound"));
        return;
      }
      const nav = {
        id: item.id,
        title: item.title,
        workspaceId: item.workspaceId,
        projectId: item.projectId,
      };
      switch (link.type) {
        case "doc":
          openDoc(nav);
          break;
        case "task":
          openTask(nav);
          break;
        case "meeting":
          openMeeting(nav);
          break;
      }
    },
    [openDoc, openTask, openMeeting]
  );
}
