"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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
 * Combines tabs + per-tab actions in one row.
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
      {/* Combined tabs + actions row */}
      <div className="px-4 py-1.5 flex items-center justify-between border-b">
        <TabsList className="h-8 w-auto">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-1.5 text-xs"
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
            </TabsTrigger>
          ))}
        </TabsList>

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
