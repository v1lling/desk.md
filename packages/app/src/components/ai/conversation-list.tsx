import { formatDistanceToNow, parseISO } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAssistantStore, type AssistantConversation as Conversation } from "@/stores/assistant";

interface ConversationListProps {
  className?: string;
}

export function ConversationList({ className }: ConversationListProps) {
  const { t } = useTranslation();
  const conversations = useAssistantStore((s) => s.conversations);
  const activeConversationId = useAssistantStore((s) => s.activeConversationId);
  const createConversation = useAssistantStore((s) => s.createConversation);
  const setActiveConversation = useAssistantStore((s) => s.setActiveConversation);
  const deleteConversation = useAssistantStore((s) => s.deleteConversation);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConversation(id);
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="shrink-0 min-h-11 py-2 px-3 border-b border-border/60 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t("assistant.conversations.heading")}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          title={t("assistant.conversations.newConversation")}
          onClick={() => createConversation()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 pb-2 space-y-0.5">
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-4 text-center">
              {t("assistant.conversations.empty")}
            </p>
          )}
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              onClick={() => setActiveConversation(conv.id)}
              onDelete={(e) => handleDelete(e, conv.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onClick,
  onDelete,
}: {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation();
  const relativeDate = formatDistanceToNow(parseISO(conversation.updatedAt), {
    addSuffix: true,
  });

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full flex items-start gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 text-foreground/80"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{conversation.title}</p>
        <p className="text-[10px] text-muted-foreground">{relativeDate}</p>
      </div>
      <button
        onClick={onDelete}
        className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
        title={t("assistant.conversations.deleteConversation")}
      >
        <Trash2 className="size-3" />
      </button>
    </button>
  );
}
