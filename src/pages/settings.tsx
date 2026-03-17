import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, Bot, Brain, FolderOpen, FileText } from "lucide-react";
import { GeneralTab, AITab, ContextTab, DataTab, TemplatesTab } from "@/components/settings";
import { TabbedPage, TabsContent, type TabConfig } from "@/components/patterns";

const tabs: TabConfig[] = [
  { value: "general", label: "General", icon: <Settings className="h-3.5 w-3.5" /> },
  { value: "templates", label: "Templates", icon: <FileText className="h-3.5 w-3.5" /> },
  { value: "ai", label: "AI", icon: <Bot className="h-3.5 w-3.5" /> },
  { value: "context", label: "Catalog", icon: <Brain className="h-3.5 w-3.5" /> },
  { value: "data", label: "Data", icon: <FolderOpen className="h-3.5 w-3.5" /> },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabbedPage tabs={tabs} defaultTab="general">
        <TabsContent value="general" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 max-w-3xl"><GeneralTab /></div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ai" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 max-w-3xl"><AITab /></div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="context" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 max-w-3xl"><ContextTab /></div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="templates" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 max-w-3xl"><TemplatesTab /></div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="data" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 max-w-3xl"><DataTab /></div>
          </ScrollArea>
        </TabsContent>
      </TabbedPage>
    </div>
  );
}
