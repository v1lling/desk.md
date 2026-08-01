import { lazy, Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSecondarySidebar } from "@/hooks/use-secondary-sidebar";
import { SettingsNav, type SettingsCategory } from "@/components/settings/settings-nav";

const GeneralTab = lazy(() =>
  import("@/components/settings/general-tab").then(({ GeneralTab }) => ({ default: GeneralTab })),
);
const PlannerTab = lazy(() =>
  import("@/components/settings/planner-tab").then(({ PlannerTab }) => ({ default: PlannerTab })),
);
const AITab = lazy(() =>
  import("@/components/settings/ai-tab").then(({ AITab }) => ({ default: AITab })),
);
const AgentsTab = lazy(() =>
  import("@/components/settings/agents-tab").then(({ AgentsTab }) => ({ default: AgentsTab })),
);
const DataTab = lazy(() =>
  import("@/components/settings/data-tab").then(({ DataTab }) => ({ default: DataTab })),
);
const TemplatesTab = lazy(() =>
  import("@/components/settings/templates-tab").then(({ TemplatesTab }) => ({
    default: TemplatesTab,
  })),
);
const AboutTab = lazy(() =>
  import("@/components/settings/about-tab").then(({ AboutTab }) => ({ default: AboutTab })),
);

const CONTENT: Record<SettingsCategory, React.ComponentType> = {
  general: GeneralTab,
  planner: PlannerTab,
  templates: TemplatesTab,
  ai: AITab,
  agents: AgentsTab,
  data: DataTab,
  about: AboutTab,
};

export default function SettingsPage() {
  const { t } = useTranslation();
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
          <Suspense
            fallback={
              <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
                {t("common.buttons.loading")}
              </div>
            }
          >
            <Active />
          </Suspense>
        </div>
      </ScrollArea>
    </div>
  );
}
