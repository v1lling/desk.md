"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidePanel } from "@/components/ui/slide-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ChatMessage } from "./chat-message";
import { useAIChatStore, useSendMessage, useAISettingsStore } from "@/stores/ai";

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AIChatPanel({ open, onClose }: AIChatPanelProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Store
  const { messages, clearMessages } = useAIChatStore();
  const sendMessage = useSendMessage();
  const { providerType, anthropicApiKey } = useAISettingsStore();

  // Check if AI is properly configured
  const isConfigured = providerType === 'claude-code' ||
    (providerType === 'anthropic-api' && anthropicApiKey);

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
    if (!input.trim() || sendMessage.isPending || !isConfigured) return;

    sendMessage.mutate({
      message: input.trim(),
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
      {/* Configuration warning */}
      {!isConfigured && (
        <div className="p-3 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-md">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            AI not configured. Go to Settings → AI to set up a provider.
          </p>
        </div>
      )}

      {/* Error display - keep generic, details in Settings */}
      {sendMessage.error && (
        <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">
            AI request failed. Check Settings → AI to test your connection.
          </p>
        </div>
      )}

      {messages.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Start a conversation with AI. Your docs are automatically included as context."
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
