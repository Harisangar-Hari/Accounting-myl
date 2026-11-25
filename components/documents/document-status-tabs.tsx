import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { DocumentStatusFilter } from "@/lib/accounting/documents";

const TABS: Array<{ value: DocumentStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

/** Status filter tabs for invoice and bill lists; preserves q/from/to. */
export function DocumentStatusTabs({
  basePath,
  status,
  params,
}: {
  basePath: string;
  status: DocumentStatusFilter;
  params: Record<string, string | undefined>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TABS.map((tab) => {
        const search = new URLSearchParams();
        if (tab.value !== "all") search.set("status", tab.value);
        for (const key of ["q", "fromDate", "toDate"]) {
          const value = params[key];
          if (value) search.set(key, value);
        }
        const query = search.toString();
        const active = tab.value === status;

        return (
          <Button
            key={tab.value}
            asChild
            size="sm"
            variant={active ? "default" : "outline"}
          >
            <Link
              href={query ? `${basePath}?${query}` : basePath}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
