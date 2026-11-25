import { Badge } from "@/components/ui/badge";
import {
  documentStatusLabel,
  type DocumentStatus,
} from "@/lib/accounting/documents";
import { cn } from "@/lib/utils";

/**
 * Status pill for invoices/bills. "Overdue" is a computed display state: the
 * stored status stays OPEN or PARTIALLY_PAID.
 */
export function DocumentStatusBadge({
  status,
  isOverdue = false,
}: {
  status: DocumentStatus;
  isOverdue?: boolean;
}) {
  const label = documentStatusLabel(status, isOverdue);

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-medium",
        isOverdue
          ? "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"
          : status === "PAID"
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
            : status === "PARTIALLY_PAID"
              ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
              : status === "CANCELLED"
                ? "bg-muted text-muted-foreground"
                : "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
      )}
    >
      {label}
    </Badge>
  );
}
