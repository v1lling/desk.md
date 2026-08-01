import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: "sm" | "md" | "lg" | "full";
}

const roundedClasses = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
} as const;

/** Theme-aware shimmer block. Its reveal is delayed in CSS to suppress fast flashes. */
export function Skeleton({ className, rounded = "md", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("desk-skeleton", roundedClasses[rounded], className)}
      {...props}
    />
  );
}
