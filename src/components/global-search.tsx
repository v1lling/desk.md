"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
} from "@/lib/orbit/search-index";
import { useSettingsStore } from "@/stores/settings";

const TYPE_ICONS: Record<SearchItemType, React.ReactNode> = {
  task: <CheckSquare className="h-4 w-4" />,
  note: <FileText className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  project: <FolderKanban className="h-4 w-4" />,
};

const TYPE_LABELS: Record<SearchItemType, string> = {
  task: "Task",
  note: "Note",
  meeting: "Meeting",
  project: "Project",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const router = useRouter();
  const currentAreaId = useSettingsStore((state) => state.currentAreaId);

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
      const recent = getRecentItems(8, undefined, currentAreaId ?? undefined);
      setResults(recent);
    } else {
      // Fuzzy search
      const searchResults = search(query, {
        limit: 10,
        areaId: currentAreaId ?? undefined,
      });
      setResults(searchResults);
    }
  }, [query, currentAreaId]);

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  // Handle item selection
  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);

      const { item } = result;

      // Navigate based on item type, with ?open= param to auto-open editor
      switch (item.type) {
        case "task":
          router.push(`/?open=${item.id}`);
          break;
        case "note":
          router.push(`/notes?open=${item.id}`);
          break;
        case "meeting":
          router.push(`/projects/view?id=${item.projectId}&meeting=${item.id}`);
          break;
        case "project":
          router.push(`/projects/view?id=${item.projectId}`);
          break;
      }
    },
    [router]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Search tasks, notes, projects..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isIndexReady()
            ? "No results found."
            : "Building search index..."}
        </CommandEmpty>

        {!query.trim() && results.length > 0 && (
          <CommandGroup heading="Recent">
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
          <CommandGroup heading="Results">
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
          <span>{TYPE_LABELS[item.type]}</span>
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
          {item.due}
        </span>
      )}
    </CommandItem>
  );
}

export default GlobalSearch;
