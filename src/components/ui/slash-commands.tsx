import { Extension, type Editor, type Range } from "@tiptap/react";
import Suggestion, {
  type SuggestionOptions,
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Table as TableIcon,
  Code2,
  Quote,
  Minus,
  Link,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Command Items ───────────────────────────────────────────────────────────

interface SlashCommandItem {
  title: string;
  aliases: string[];
  description: string;
  icon: React.ReactNode;
  command: (editor: Editor, range: Range) => void;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    title: "Heading 1",
    aliases: ["h1"],
    description: "Large section heading",
    icon: <Heading1 className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    aliases: ["h2"],
    description: "Medium section heading",
    icon: <Heading2 className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    aliases: ["h3"],
    description: "Small section heading",
    icon: <Heading3 className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    aliases: ["bullet", "ul", "unordered"],
    description: "Unordered list",
    icon: <List className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    aliases: ["numbered", "ol", "ordered"],
    description: "Ordered list",
    icon: <ListOrdered className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task List",
    aliases: ["task", "checkbox", "todo", "check"],
    description: "Task list with checkboxes",
    icon: <CheckSquare className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Table",
    aliases: ["table"],
    description: "Insert a 3×3 table",
    icon: <TableIcon className="size-4" />,
    command: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    title: "Code Block",
    aliases: ["code", "codeblock", "pre"],
    description: "Code block",
    icon: <Code2 className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Blockquote",
    aliases: ["quote", "blockquote"],
    description: "Block quotation",
    icon: <Quote className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Divider",
    aliases: ["divider", "hr", "rule", "separator"],
    description: "Horizontal rule",
    icon: <Minus className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "Link",
    aliases: ["link", "url"],
    description: "Insert a note link",
    icon: <Link className="size-4" />,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent("slash-command:open-link-picker"));
    },
  },
];

// ─── Filter ──────────────────────────────────────────────────────────────────

function filterCommands(query: string): SlashCommandItem[] {
  if (!query) return SLASH_COMMANDS;
  const lower = query.toLowerCase();
  return SLASH_COMMANDS.filter(
    (item) =>
      item.title.toLowerCase().includes(lower) ||
      item.aliases.some((a) => a.includes(lower))
  );
}

// ─── Popup Component ─────────────────────────────────────────────────────────

interface SlashCommandsListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export interface SlashCommandsListRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashCommandsList = forwardRef<SlashCommandsListRef, SlashCommandsListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    // Scroll selected item into view
    useEffect(() => {
      const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="slash-commands-popup">
          <div className="px-3 py-2 text-sm text-muted-foreground">
            No matching commands
          </div>
        </div>
      );
    }

    return (
      <div ref={listRef} className="slash-commands-popup">
        {items.map((item, index) => (
          <button
            key={item.title}
            className={cn(
              "flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-sm text-left",
              "hover:bg-accent",
              index === selectedIndex && "bg-accent text-accent-foreground"
            )}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
              {item.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-muted-foreground truncate">
                {item.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);
SlashCommandsList.displayName = "SlashCommandsList";

// ─── Positioning Helper ──────────────────────────────────────────────────────

function updatePosition(
  popup: HTMLDivElement,
  clientRect: (() => DOMRect | null) | null | undefined
) {
  if (!clientRect) return;
  const rect = clientRect();
  if (!rect) return;

  // Position below cursor, flip above if near bottom of viewport
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < 300) {
    popup.style.left = `${rect.left}px`;
    popup.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    popup.style.top = "";
  } else {
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 4}px`;
    popup.style.bottom = "";
  }
}

// ─── Suggestion Render ───────────────────────────────────────────────────────

function createSuggestionRender(): SuggestionOptions<SlashCommandItem, SlashCommandItem>["render"] {
  return () => {
    let popup: HTMLDivElement | null = null;
    let root: Root | null = null;
    const refHolder: { current: SlashCommandsListRef | null } = { current: null };

    return {
      onStart(props: SuggestionProps<SlashCommandItem, SlashCommandItem>) {
        popup = document.createElement("div");
        popup.style.position = "fixed";
        popup.style.zIndex = "50";
        document.body.appendChild(popup);
        updatePosition(popup, props.clientRect);

        root = createRoot(popup);
        root.render(
          <SlashCommandsList
            ref={(handle) => {
              refHolder.current = handle;
            }}
            items={props.items}
            command={(item) => props.command(item)}
          />
        );
      },

      onUpdate(props: SuggestionProps<SlashCommandItem, SlashCommandItem>) {
        if (!popup || !root) return;
        updatePosition(popup, props.clientRect);
        root.render(
          <SlashCommandsList
            ref={(handle) => {
              refHolder.current = handle;
            }}
            items={props.items}
            command={(item) => props.command(item)}
          />
        );
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === "Escape") {
          return false;
        }
        return refHolder.current?.onKeyDown(props.event) ?? false;
      },

      onExit() {
        root?.unmount();
        popup?.remove();
        root = null;
        popup = null;
      },
    };
  };
}

// ─── Tiptap Extension ────────────────────────────────────────────────────────

const slashCommandsPluginKey = new PluginKey("slashCommands");

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        pluginKey: slashCommandsPluginKey,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        allowedPrefixes: [" "],
        items: ({ query }) => filterCommands(query),
        command: ({ editor, range, props: item }) => {
          item.command(editor, range);
        },
        render: createSuggestionRender(),
      }),
    ];
  },
});
