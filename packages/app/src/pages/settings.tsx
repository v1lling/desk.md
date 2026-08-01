import { lazy, Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, FileText, FolderOpen, Info, Settings, Sparkles, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingsPageHeader } from "@/components/ui/settings-section";
import { useSecondarySidebar } from "@/hooks/use-secondary-sidebar";
import { SettingsNav, type SettingsCategory } from "@/components/settings/settings-nav";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

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

const PAGE_META: Record<
  SettingsCategory,
  { titleKey: string; descriptionKey: string; icon: typeof Settings }
> = {
  general: {
    titleKey: "settings.nav.general",
    descriptionKey: "settings.pageDescriptions.general",
    icon: Settings,
  },
  planner: {
    titleKey: "settings.nav.planner",
    descriptionKey: "settings.pageDescriptions.planner",
    icon: Calendar,
  },
  templates: {
    titleKey: "settings.nav.templates",
    descriptionKey: "settings.pageDescriptions.templates",
    icon: FileText,
  },
  ai: {
    titleKey: "settings.nav.ai",
    descriptionKey: "settings.pageDescriptions.ai",
    icon: Sparkles,
  },
  agents: {
    titleKey: "settings.agents.title",
    descriptionKey: "settings.pageDescriptions.agents",
    icon: Users,
  },
  data: {
    titleKey: "settings.nav.data",
    descriptionKey: "settings.pageDescriptions.data",
    icon: FolderOpen,
  },
  about: {
    titleKey: "settings.nav.about",
    descriptionKey: "settings.pageDescriptions.about",
    icon: Info,
  },
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
  const pageMeta = PAGE_META[category];
  const PageIcon = pageMeta.icon;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* key per category remounts the scroll container so each tab starts at the top */}
      <ScrollArea key={category} className="flex-1 min-h-0">
        <div className="mx-auto w-full max-w-[820px] space-y-8 px-6 py-8 lg:px-8">
          <SettingsPageHeader
            title={t(pageMeta.titleKey)}
            description={t(pageMeta.descriptionKey)}
            icon={<PageIcon className="size-4" />}
          />
          <Suspense
            fallback={<LoadingSkeleton variant="page" className="min-h-96" />}
          >
            <Active />
          </Suspense>
        </div>
      </ScrollArea>
    </div>
  );
}
