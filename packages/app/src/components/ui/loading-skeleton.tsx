import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

type LoadingSkeletonVariant = "page" | "cards" | "list" | "tree" | "board" | "editor";

interface LoadingSkeletonProps {
  variant?: LoadingSkeletonVariant;
  rows?: number;
  className?: string;
  /** Skeletons remain invisible for this long so fast reads never flash. */
  delayMs?: number;
  /** Page/editor boundaries announce once; nested panel skeletons stay quiet. */
  announce?: boolean;
}

function Rows({ count, compact = false }: { count: number; compact?: boolean }) {
  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={cn(
            "flex items-center gap-2",
            compact ? "h-7 px-2" : "h-10 px-3",
          )}
        >
          <Skeleton rounded="full" className={compact ? "size-2.5" : "size-3"} />
          <Skeleton className={cn("h-3", index % 3 === 0 ? "w-2/3" : "w-1/2")} />
          <Skeleton className="ml-auto h-2.5 w-12" />
        </div>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="space-y-2 rounded-xl border border-border/60 p-3">
        <Rows count={6} />
      </div>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={cn(
            "space-y-4 rounded-xl border border-border/60 bg-card p-4",
            index === 2 && "lg:col-span-2",
          )}
        >
          <div className="flex items-center gap-2">
            <Skeleton rounded="full" className="size-4" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Rows count={index === 2 ? 3 : 4} compact />
        </div>
      ))}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid min-h-80 grid-flow-col auto-cols-[280px] gap-3 overflow-hidden pt-3">
      {[0, 1, 2, 3].map((column) => (
        <div key={column} className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-3">
          <div className="flex items-center gap-2">
            <Skeleton rounded="full" className="size-2.5" />
            <Skeleton className="h-3 w-20" />
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row} className="space-y-3 rounded-lg border border-border/50 bg-card p-3">
              <Skeleton className={cn("h-3", row % 2 === 0 ? "w-4/5" : "w-3/5")} />
              <Skeleton className="h-2.5 w-2/5" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="h-8 border-b border-border/40 px-6 py-2">
        <Skeleton className="h-2.5 w-40" />
      </div>
      <div className="mx-auto w-full max-w-4xl space-y-4 px-6 py-5">
        <Skeleton className="h-7 w-2/5" />
        <div className="flex gap-2 border-b border-border/40 pb-4">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="space-y-3 pt-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="mt-6 h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}

/**
 * Shared cold-load placeholder. It deliberately has no visible copy; the live
 * region keeps the state understandable to assistive technology.
 */
export function LoadingSkeleton({
  variant = "page",
  rows = 6,
  className,
  delayMs = 160,
  announce = variant === "page" || variant === "editor",
}: LoadingSkeletonProps) {
  const { t } = useTranslation();
  const style = { "--desk-loading-delay": `${delayMs}ms` } as CSSProperties;

  return (
    <div
      className={cn("desk-loading-reveal h-full min-h-0", className)}
      style={style}
      role={announce ? "status" : undefined}
      aria-live={announce ? "polite" : undefined}
      aria-busy="true"
    >
      {announce && <span className="sr-only">{t("common.buttons.loading")}</span>}
      {variant === "page" && <PageSkeleton />}
      {variant === "cards" && <CardsSkeleton />}
      {variant === "list" && <Rows count={rows} />}
      {variant === "tree" && <Rows count={rows} compact />}
      {variant === "board" && <BoardSkeleton />}
      {variant === "editor" && <EditorSkeleton />}
    </div>
  );
}
