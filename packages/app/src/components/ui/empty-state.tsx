import type { LucideIcon } from "lucide-react";
import { StatePanel } from "./state-panel";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
  action?: React.ReactNode;
  display?: "card" | "inline";
}

export function EmptyState({ title, description, icon, className, action, display }: EmptyStateProps) {
  return (
    <StatePanel
      variant="empty"
      title={title}
      description={description}
      icon={icon}
      action={action}
      display={display}
      className={className}
    />
  );
}
