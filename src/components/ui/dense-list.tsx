import { cn } from "@/lib/utils";

interface DenseListProps {
  children: React.ReactNode;
  className?: string;
}

export function DenseList({ children, className }: DenseListProps) {
  return <div className={cn("space-y-1", className)}>{children}</div>;
}
