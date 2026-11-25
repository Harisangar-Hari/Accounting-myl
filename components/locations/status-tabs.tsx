import Link from "next/link";
import { Button } from "@/components/ui/button";

export type StatusFilter = "all" | "active" | "inactive";

const TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

/** All / Active / Inactive filter tabs driven by the ?status= search param. */
export function StatusTabs({
  basePath,
  status,
}: {
  basePath: string;
  status: StatusFilter;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TABS.map((tab) => {
        const active = tab.value === status;
        return (
          <Button
            key={tab.value}
            asChild
            size="sm"
            variant={active ? "default" : "outline"}
          >
            <Link
              href={
                tab.value === "all" ? basePath : `${basePath}?status=${tab.value}`
              }
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
