import type { EntryStatus, EntryType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: EntryStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-medium",
        status === "POSTED"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-medium",
        active
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

export function EntryTypeBadge({ entryType }: { entryType: EntryType }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {entryType === "EXPENSE" ? "Expense" : "General"}
    </Badge>
  );
}
