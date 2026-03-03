
import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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

/**
 * Reusable component for tab-based pages.
 * Underline-style navigation tabs with optional per-tab actions.
 *
 * Usage:
 * ```tsx
 * <TabbedPage
 *   tabs={[
 *     { value: "tasks", label: "Tasks", badge: 5, actions: <Button>New</Button> },
 *     { value: "docs", label: "Docs" },
 *   ]}
 * >
 *   <TabsContent value="tasks">...</TabsContent>
 *   <TabsContent value="docs">...</TabsContent>
 * </TabbedPage>
 * ```
 */
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

  // Find actions for current tab
  const currentActions = tabs.find((t) => t.value === activeTab)?.actions;

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      {/* Underline-style tab nav row */}
      <div className="px-4 flex items-center justify-between border-b">
        <TabsPrimitive.List className="flex items-center gap-1">
          {tabs.map((tab) => (
            <TabsPrimitive.Trigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium",
                "text-muted-foreground hover:text-foreground transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm",
                "data-[state=active]:text-foreground",
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
              {/* Active underline indicator */}
              <span
                className={cn(
                  "absolute bottom-0 left-2 right-2 h-[2px] rounded-full",
                  "bg-transparent data-[active=true]:bg-foreground transition-colors",
                )}
                data-active={tab.value === activeTab}
              />
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        {/* Actions for current tab */}
        {currentActions && (
          <div className="flex items-center gap-2">{currentActions}</div>
        )}
      </div>

      {/* Tab content passed as children */}
      {children}
    </Tabs>
  );
}

// Re-export TabsContent for convenience
export { TabsContent } from "@/components/ui/tabs";
