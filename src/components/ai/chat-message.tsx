"use client";

import { cn } from "@/lib/utils";
import { Bot, User, FileText, CheckSquare, Calendar } from "lucide-react";
import type { AIMessage } from "@/lib/ai";

interface ChatMessageProps {
  message: AIMessage;
}

function SourceIcon({ type }: { type: 'doc' | 'task' | 'meeting' }) {
  switch (type) {
    case 'task':
      return <CheckSquare className="h-3 w-3" />;
    case 'meeting':
      return <Calendar className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
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
          <div className="flex flex-wrap gap-1.5 px-1">
            <span className="text-xs text-muted-foreground">Sources:</span>
            {message.sources.map((source, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5"
                title={source.docPath}
              >
                <SourceIcon type={source.contentType} />
                <span className="max-w-[150px] truncate">{source.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
