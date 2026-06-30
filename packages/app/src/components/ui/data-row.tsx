import { cn } from "@/lib/utils";
import { densityClasses, type Density } from "@/lib/enterprise-ui";

interface DataRowProps {
  children: React.ReactNode;
  density?: Density;
  active?: boolean;
  className?: string;
}

export function DataRow({
  children,
  density = "regular",
  active = false,
  className,
}: DataRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md transition-colors",
        densityClasses[density].row,
        active
          ? "bg-accent text-accent-foreground"
          : "text-foreground/85 hover:bg-accent/60",
        className
      )}
    >
      {children}
    </div>
  );
}
