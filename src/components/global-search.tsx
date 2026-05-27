
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  CheckSquare,
  FileText,
  Calendar,
  FolderKanban,
  Clock,
} from "lucide-react";
import {
  search,
  getRecentItems,
  isIndexReady,
  type SearchResult,
  type SearchItemType,
} from "@/lib/desk/search-index";
import { useNavigationStore } from "@/stores/navigation";
import { useOpenTab } from "@/stores/tabs";

const TYPE_ICONS: Record<SearchItemType, React.ReactNode> = {
  task: <CheckSquare className="h-4 w-4" />,
  doc: <FileText className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  project: <FolderKanban className="h-4 w-4" />,
};

const TYPE_LABEL_KEYS: Record<SearchItemType, string> = {
  task: "search.globalSearch.types.task",
  doc: "search.globalSearch.types.doc",
  meeting: "search.globalSearch.types.meeting",
  project: "search.globalSearch.types.project",
};

/**
 * Open the global search dialog. GlobalSearch has no open-store — it listens
 * for ⌘K / Ctrl+K on the document — so this dispatches that shortcut.
 */
export function openGlobalSearch() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
}

export function GlobalSearch() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const currentWorkspaceId = useNavigationStore((state) => state.currentWorkspaceId);

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search when query changes
  useEffect(() => {
    if (!isIndexReady()) {
      setResults([]);
      return;
    }

    if (!query.trim()) {
      // Show recent items when no query
      const recent = getRecentItems(8, undefined, currentWorkspaceId ?? undefined);
      setResults(recent);
    } else {
      // Fuzzy search
      const searchResults = search(query, {
        limit: 10,
        workspaceId: currentWorkspaceId ?? undefined,
      });
      setResults(searchResults);
    }
  }, [query, currentWorkspaceId]);

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const { openTask, openDoc, openMeeting } = useOpenTab();

  // Handle item selection
  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);

      const { item } = result;

      // Open in tab for tasks, docs, meetings; navigate for projects
      switch (item.type) {
        case "task":
          openTask({
            id: item.id,
            title: item.title,
            workspaceId: item.workspaceId,
            projectId: item.projectId,
          });
          break;
        case "doc":
          openDoc({
            id: item.id,
            title: item.title,
            workspaceId: item.workspaceId,
            projectId: item.projectId,
          });
          break;
        case "meeting":
          openMeeting({
            id: item.id,
            title: item.title,
            workspaceId: item.workspaceId,
            projectId: item.projectId,
          });
          break;
        case "project":
          navigate(`/projects?open=${encodeURIComponent(item.id)}`);
          break;
      }
    },
    [navigate, openTask, openDoc, openMeeting]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder={t("search.globalSearch.placeholder")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isIndexReady()
            ? t("search.globalSearch.noResults")
            : t("search.globalSearch.buildingIndex")}
        </CommandEmpty>

        {!query.trim() && results.length > 0 && (
          <CommandGroup heading={t("search.globalSearch.recentHeading")}>
            {results.map((result) => (
              <SearchResultItem
                key={`${result.item.type}-${result.item.id}`}
                result={result}
                onSelect={handleSelect}
              />
            ))}
          </CommandGroup>
        )}

        {query.trim() && results.length > 0 && (
          <CommandGroup heading={t("search.globalSearch.resultsHeading")}>
            {results.map((result) => (
              <SearchResultItem
                key={`${result.item.type}-${result.item.id}`}
                result={result}
                onSelect={handleSelect}
              />
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function SearchResultItem({
  result,
  onSelect,
}: {
  result: SearchResult;
  onSelect: (result: SearchResult) => void;
}) {
  const { t } = useTranslation();
  const { item } = result;

  return (
    <CommandItem
      value={`${item.type}-${item.id}-${item.title}`}
      onSelect={() => onSelect(result)}
      className="flex items-center gap-3 py-2"
    >
      <span className="text-muted-foreground">{TYPE_ICONS[item.type]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{item.title}</span>
          {item.status && (
            <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
              {item.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t(TYPE_LABEL_KEYS[item.type])}</span>
          {item.projectName && item.type !== "project" && (
            <>
              <span>·</span>
              <span className="truncate">{item.projectName}</span>
            </>
          )}
        </div>
      </div>
      {item.due && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDate(item.due)}
        </span>
      )}
    </CommandItem>
  );
}

export default GlobalSearch;
