import { formatDistanceToNow, parseISO } from "date-fns";
import { Plus, Trash2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAIChatStore, type Conversation } from "@/stores/ai";
import { useWorkspaces } from "@/stores/workspaces";

const DEFAULT_WORKSPACE_COLOR = "#64748b";

interface ConversationListProps {
  className?: string;
}

export function ConversationList({ className }: ConversationListProps) {
  const conversations = useAIChatStore((s) => s.conversations);
  const activeConversationId = useAIChatStore((s) => s.activeConversationId);
  const createConversation = useAIChatStore((s) => s.createConversation);
  const setActiveConversation = useAIChatStore((s) => s.setActiveConversation);
  const deleteConversation = useAIChatStore((s) => s.deleteConversation);
  const { data: workspaces = [] } = useWorkspaces();

  const getWorkspaceColor = (workspaceId: string | null) => {
    if (!workspaceId) return DEFAULT_WORKSPACE_COLOR;
    const ws = workspaces.find((w) => w.id === workspaceId);
    return ws?.color || DEFAULT_WORKSPACE_COLOR;
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConversation(id);
  };

  return (
    <div className={cn("flex flex-col h-full border-r bg-muted/30", className)}>
      {/* Header */}
      <div className="shrink-0 p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={createConversation}
        >
          <Plus className="h-3.5 w-3.5" />
          New Chat
        </Button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 pb-2 space-y-0.5">
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-4 text-center">
              No conversations yet
            </p>
          )}
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              workspaceColor={getWorkspaceColor(conv.workspaceId)}
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
  workspaceColor,
  onClick,
  onDelete,
}: {
  conversation: Conversation;
  isActive: boolean;
  workspaceColor: string;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
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
      <Circle
        className="size-2 shrink-0 mt-1.5"
        style={{ color: workspaceColor }}
        fill={workspaceColor}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{conversation.title}</p>
        <p className="text-[10px] text-muted-foreground">{relativeDate}</p>
      </div>
      <button
        onClick={onDelete}
        className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
        title="Delete conversation"
      >
        <Trash2 className="size-3" />
      </button>
    </button>
  );
}
