"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings, Bot, Brain, FolderOpen } from "lucide-react";
import { GeneralTab, AITab, RAGTab, DataTab } from "@/components/settings";

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <main className="p-4">
          <div className="max-w-2xl">
            <Tabs defaultValue="general" className="space-y-4">
              <TabsList>
                <TabsTrigger value="general" className="gap-1.5">
                  <Settings className="h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="ai" className="gap-1.5">
                  <Bot className="h-4 w-4" />
                  AI
                </TabsTrigger>
                <TabsTrigger value="rag" className="gap-1.5">
                  <Brain className="h-4 w-4" />
                  RAG
                </TabsTrigger>
                <TabsTrigger value="data" className="gap-1.5">
                  <FolderOpen className="h-4 w-4" />
                  Data
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general">
                <GeneralTab />
              </TabsContent>

              <TabsContent value="ai">
                <AITab />
              </TabsContent>

              <TabsContent value="rag">
                <RAGTab />
              </TabsContent>

              <TabsContent value="data">
                <DataTab />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </ScrollArea>
    </div>
  );
}
