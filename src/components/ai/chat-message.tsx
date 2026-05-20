
import { cn } from "@/lib/utils";
import { AlertTriangle, Bot, User } from "lucide-react";
import type { AssistantMessage } from "@/lib/assistant/types";
import { SourcesDisplay } from "./sources-display";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  message: AssistantMessage;
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
        {isUser ? (
          <div className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ) : (
          <>
            {message.content && (
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-background/50">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </div>
            )}

            {message.error && (
              <div className="flex gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="min-w-0 whitespace-pre-wrap break-words">{message.error}</p>
              </div>
            )}

            {/* Sources display for assistant messages */}
            {message.sources && message.sources.length > 0 && (
              <SourcesDisplay sources={message.sources} className="px-1" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
