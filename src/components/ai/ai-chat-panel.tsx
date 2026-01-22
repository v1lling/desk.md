"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidePanel } from "@/components/ui/slide-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ChatMessage } from "./chat-message";
import { DocSelector } from "./doc-selector";
import { useAIChatStore, useSendMessage } from "@/stores/ai";
import { useAllWorkspaceDocs } from "@/stores/docs";
import { useSettingsStore } from "@/stores/settings";
import type { AIContext } from "@/lib/ai";

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AIChatPanel({ open, onClose }: AIChatPanelProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Store
  const { messages, selectedDocs, toggleDoc, clearMessages } = useAIChatStore();
  const sendMessage = useSendMessage();

  // Get all docs for the workspace (includes nested folders via recursive tree traversal)
  const currentWorkspaceId = useSettingsStore((s) => s.currentWorkspaceId);
  const { data: allDocs = [] } = useAllWorkspaceDocs(currentWorkspaceId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;

    // Build context from selected docs
    const context: AIContext | undefined =
      selectedDocs.length > 0
        ? {
            docs: allDocs
              .filter((d) => selectedDocs.includes(d.id))
              .map((d) => ({ id: d.id, title: d.title, content: d.content })),
          }
        : undefined;

    sendMessage.mutate({
      message: input.trim(),
      context,
      history: messages,
    });

    setInput("");
  };

  const handleClear = () => {
    clearMessages();
  };

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title="AI Chat"
      headerActions={
        messages.length > 0 ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="h-8 w-8"
            title="Clear conversation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : undefined
      }
      footer={
        <form onSubmit={handleSubmit} className="flex gap-2">
          <DocSelector
            docs={allDocs}
            selectedIds={selectedDocs}
            onToggle={toggleDoc}
            disabled={sendMessage.isPending}
          />
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            disabled={sendMessage.isPending}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || sendMessage.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      }
    >
      {messages.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Start a conversation with AI. Select docs for context."
          icon={MessageSquare}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {sendMessage.isPending && (
            <LoadingState label="AI response" height="h-16" spinner />
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </SlidePanel>
  );
}
