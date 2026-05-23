import { Settings, Bot, Brain, FolderOpen, FileText, Sparkles, Info, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsCategory =
  | "general"
  | "templates"
  | "ai"
  | "assistant"
  | "agents"
  | "context"
  | "data"
  | "about";

/**
 * Keyed by SettingsCategory so TypeScript enforces an entry for every category —
 * adding a category to the union without one here is a compile error. Object key
 * order drives the nav order.
 */
const CATEGORY_META: Record<
  SettingsCategory,
  { label: string; icon: typeof Settings }
> = {
  general: { label: "General", icon: Settings },
  templates: { label: "Templates", icon: FileText },
  ai: { label: "AI Provider", icon: Sparkles },
  assistant: { label: "Assistant", icon: Bot },
  agents: { label: "Agents", icon: Users },
  context: { label: "Catalog", icon: Brain },
  data: { label: "Data", icon: FolderOpen },
  about: { label: "About", icon: Info },
};

export const SETTINGS_CATEGORIES = (
  Object.keys(CATEGORY_META) as SettingsCategory[]
).map((value) => ({ value, ...CATEGORY_META[value] }));

interface SettingsNavProps {
  active: SettingsCategory;
  onSelect: (category: SettingsCategory) => void;
}

export function SettingsNav({ active, onSelect }: SettingsNavProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 min-h-11 py-2 px-3 border-b border-border/60 flex items-center">
        <span className="text-sm font-medium">Settings</span>
      </div>

      {/* Category list */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        {SETTINGS_CATEGORIES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors",
              value === active
                ? "bg-accent text-accent-foreground"
                : "text-foreground/80 hover:bg-accent/50",
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
