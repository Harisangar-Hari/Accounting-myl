import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Renders integer cents right-aligned in tabular monospace. */
export function Money({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {formatCents(cents)}
    </span>
  );
}
