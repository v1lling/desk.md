import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSecondarySidebar } from "@/hooks/use-secondary-sidebar";
import {
  GeneralTab,
  AITab,
  ContextTab,
  DataTab,
  TemplatesTab,
  SettingsNav,
  type SettingsCategory,
} from "@/components/settings";

const CONTENT: Record<SettingsCategory, React.ComponentType> = {
  general: GeneralTab,
  templates: TemplatesTab,
  ai: AITab,
  context: ContextTab,
  data: DataTab,
};

export default function SettingsPage() {
  const [category, setCategory] = useState<SettingsCategory>("general");

  const nav = useMemo(
    () => <SettingsNav active={category} onSelect={setCategory} />,
    [category],
  );
  useSecondarySidebar("/settings", nav);

  const Active = CONTENT[category];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* key per category remounts the scroll container so each tab starts at the top */}
      <ScrollArea key={category} className="flex-1 min-h-0">
        <div className="p-4 max-w-3xl">
          <Active />
        </div>
      </ScrollArea>
    </div>
  );
}
