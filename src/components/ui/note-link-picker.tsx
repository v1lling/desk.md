
import { useEffect, useState, useCallback, useRef } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CheckSquare, FileText, Calendar } from "lucide-react";
import {
  search,
  getRecentItems,
  isIndexReady,
  type SearchResult,
  type SearchItemType,
} from "@/lib/desk/search-index";

const LINKABLE_TYPES: SearchItemType[] = ["doc", "task", "meeting"];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  task: <CheckSquare className="h-4 w-4" />,
  doc: <FileText className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
};

interface NoteLinkPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: {
    type: SearchItemType;
    id: string;
    title: string;
  }) => void;
}

export function NoteLinkPicker({
  open,
  onOpenChange,
  onSelect,
}: NoteLinkPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !isIndexReady()) {
      setResults([]);
      return;
    }
    if (!query.trim()) {
      setResults(getRecentItems(8, LINKABLE_TYPES));
    } else {
      setResults(search(query, { types: LINKABLE_TYPES, limit: 10 }));
    }
  }, [query, open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Reset scroll position when results change to prevent cmdk's
  // auto-select scrollIntoView from hiding the top result
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [results]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onSelect({
        type: result.item.type,
        id: result.item.id,
        title: result.item.title,
      });
      onOpenChange(false);
    },
    [onSelect, onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search notes to link..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList ref={listRef}>
        <CommandEmpty>
          {isIndexReady() ? "No notes found." : "Building search index..."}
        </CommandEmpty>
        <CommandGroup heading={query.trim() ? "Results" : "Recent"}>
          {results.map((result) => (
            <CommandItem
              key={`${result.item.type}-${result.item.id}`}
              value={`${result.item.type}-${result.item.id}-${result.item.title}`}
              onSelect={() => handleSelect(result)}
              className="flex items-center gap-3 py-2"
            >
              <span className="text-muted-foreground">
                {TYPE_ICONS[result.item.type]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {result.item.title}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[
                    result.item.workspaceName,
                    result.item.projectName,
                    result.item.type.charAt(0).toUpperCase() +
                      result.item.type.slice(1),
                  ]
                    .filter(Boolean)
                    .join(" \u203a ")}
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
