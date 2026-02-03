"use client";

import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import type { AIMessage } from "@/lib/ai";
import { SourcesDisplay } from "./sources-display";

interface ChatMessageProps {
  message: AIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary" : "bg-muted"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="max-w-[80%] space-y-2">
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Sources display for assistant messages */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesDisplay sources={message.sources} className="px-1" />
        )}
      </div>
    </div>
  );
}
