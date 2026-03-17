import { cn } from "@/lib/utils";
import { appSurfaceClasses, densityClasses, type Density } from "@/lib/enterprise-ui";

interface DataCardProps {
  children: React.ReactNode;
  density?: Density;
  className?: string;
}

export function DataCard({ children, density = "regular", className }: DataCardProps) {
  return (
    <section
      className={cn(
        appSurfaceClasses.card,
        densityClasses[density].card,
        className
      )}
    >
      {children}
    </section>
  );
}
