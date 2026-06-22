import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TabConfig {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
  actions?: React.ReactNode;
}

interface TabbedPageProps {
  tabs: TabConfig[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  children: React.ReactNode;
}

export function TabbedPage({
  tabs,
  defaultTab,
  activeTab: controlledTab,
  onTabChange,
  children,
}: TabbedPageProps) {
  const [internalTab, setInternalTab] = useState(defaultTab || tabs[0]?.value);
  const activeTab = controlledTab ?? internalTab;

  const handleTabChange = (value: string) => {
    setInternalTab(value);
    onTabChange?.(value);
  };

  const currentActions = tabs.find((t) => t.value === activeTab)?.actions;

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <div className="px-4 h-11 flex items-center justify-between border-b border-border/80 bg-muted/15">
        <TabsPrimitive.List className="flex items-center gap-1.5">
          {tabs.map((tab) => (
            <TabsPrimitive.Trigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "relative flex h-9 items-center gap-1.5 px-3 rounded-md text-xs font-medium",
                "text-muted-foreground hover:text-foreground transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "data-[state=active]:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/80"
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 px-1 text-[10px]"
                >
                  {tab.badge}
                </Badge>
              )}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        {currentActions && <div className="flex items-center gap-2">{currentActions}</div>}
      </div>

      {children}
    </Tabs>
  );
}

export { TabsContent } from "@/components/ui/tabs";
