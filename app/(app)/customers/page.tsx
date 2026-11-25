import Link from "next/link";
import { Plus } from "lucide-react";
import { CustomerSearch } from "@/components/customers/customer-search";
import { CustomerStatusButton } from "@/components/customers/customer-status-button";
import { SavedToast } from "@/components/saved-toast";
import { ActiveBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCustomers } from "@/lib/accounting/queries";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Customers" };

type StatusFilter = "all" | "active" | "inactive";

const TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function parseStatus(value: string | undefined): StatusFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

function tabHref(status: StatusFilter, q: string): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/customers?${query}` : "/customers";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; created?: string }>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const query = (params.q ?? "").trim();
  const allCustomers = await listCustomers({
    includeInactive: true,
    search: query || undefined,
  });
  const customers =
    status === "all"
      ? allCustomers
      : allCustomers.filter(
          (customer) => customer.isActive === (status === "active"),
        );

  return (
    <div className="space-y-5">
      <SavedToast
        message={
          params.created ? `Customer ${params.created} created.` : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Customers
          </h1>
          <p className="text-sm text-muted-foreground">
            {allCustomers.length} customer{allCustomers.length === 1 ? "" : "s"}.
            Customers link to jobs and never affect the ledger.
          </p>
        </div>
        <Button asChild>
          <Link href="/customers/new">
            <Plus className="size-4" />
            New Customer
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  href={tabHref(tab.value, query)}
                  aria-current={active ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              </Button>
            );
          })}
        </div>
        <CustomerSearch initialQuery={query} />
      </div>

      {customers.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background/60 px-6 py-12 text-center text-sm text-muted-foreground">
          {allCustomers.length === 0 && !query
            ? "No customers yet. Add your first customer to start linking jobs."
            : "No customers match this filter."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-3">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Jobs</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id} className="relative odd:bg-muted/25">
                  <TableCell className="pl-3 font-mono text-xs font-medium">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="after:absolute after:inset-0 after:content-[''] hover:underline"
                    >
                      {customer.code}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {customer.jobCount}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCents(customer.outstandingCents)}
                  </TableCell>
                  <TableCell>
                    <ActiveBadge active={customer.isActive} />
                  </TableCell>
                  <TableCell className="pr-3">
                    <div className="relative z-10 flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/customers/${customer.id}/edit`}>Edit</Link>
                      </Button>
                      <CustomerStatusButton
                        customerId={customer.id}
                        customerCode={customer.code}
                        isActive={customer.isActive}
                        jobCount={customer.jobCount}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
