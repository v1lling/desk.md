import { Calendar, CheckSquare, FileText } from "lucide-react";
import type { RecentWorkKind } from "@desk/core";
import { ListRow } from "@/components/patterns";
import { formatRelativeTime } from "@/lib/i18n/format";

const recentWorkIcons = {
  task: CheckSquare,
  meeting: Calendar,
  doc: FileText,
} satisfies Record<RecentWorkKind, typeof CheckSquare>;

export interface RecentWorkListItem {
  kind: RecentWorkKind;
  id: string;
  title: string;
  activityAt: string;
  location?: string;
  onOpen: () => void;
}

export function RecentWorkList({ items }: { items: RecentWorkListItem[] }) {
  return (
    <div className="-mx-1">
      {items.map((item) => {
        const Icon = recentWorkIcons[item.kind];
        return (
          <ListRow
            key={`${item.kind}:${item.id}`}
            onClick={item.onOpen}
            leading={<Icon className="size-3.5 shrink-0 text-muted-foreground" />}
            title={item.title}
            secondLine={item.location}
            meta={formatRelativeTime(item.activityAt)}
          />
        );
      })}
    </div>
  );
}
