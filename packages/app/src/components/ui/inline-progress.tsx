import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineProgressProps {
  className?: string;
}

/** Standard progress glyph for buttons and explicitly long inline operations. */
export function InlineProgress({ className }: InlineProgressProps) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
    />
  );
}
