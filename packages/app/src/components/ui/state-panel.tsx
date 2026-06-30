import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { appSurfaceClasses } from "@/lib/enterprise-ui";

type StateVariant = "loading" | "empty" | "error" | "notFound";

interface StatePanelProps {
  variant: StateVariant;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  /** "card" (default) renders with full border/bg. "inline" is borderless for use inside list sections. */
  display?: "card" | "inline";
  className?: string;
}

export function StatePanel({
  variant,
  title,
  description,
  icon: Icon,
  action,
  display = "card",
  className,
}: StatePanelProps) {
  const isLoading = variant === "loading";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-12 text-center",
        display === "card" && [appSurfaceClasses.card, "rounded-xl"],
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : (
        Icon && <Icon className="h-10 w-10 text-muted-foreground/60" />
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground max-w-md">{description}</p>}
      {action}
    </div>
  );
}
