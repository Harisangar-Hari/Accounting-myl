import Link from "next/link";
import { Plus } from "lucide-react";
import { SearchInput } from "@/components/documents/search-input";
import { SavedToast } from "@/components/saved-toast";
import { ActiveBadge } from "@/components/status-badge";
import { SupplierStatusButton } from "@/components/suppliers/supplier-status-button";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  StatusTabs,
  type StatusFilter,
} from "@/components/locations/status-tabs";
import { listSuppliers } from "@/lib/accounting/ap-queries";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Suppliers" };

function parseStatus(value: string | undefined): StatusFilter {
  return value === "active" || value === "inactive" ? value : "all";
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; created?: string }>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const query = (params.q ?? "").trim();
  const allSuppliers = await listSuppliers({
    includeInactive: true,
    search: query || undefined,
  });
  const suppliers =
    status === "all"
      ? allSuppliers
      : allSuppliers.filter(
          (supplier) => supplier.isActive === (status === "active"),
        );

  return (
    <div className="space-y-5">
      <SavedToast
        message={
          params.created ? `Supplier ${params.created} created.` : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Suppliers
          </h1>
          <p className="text-sm text-muted-foreground">
            {allSuppliers.length} supplier
            {allSuppliers.length === 1 ? "" : "s"}. Suppliers receive bills and
            payments; they never get their own ledger accounts.
          </p>
        </div>
        <Button asChild>
          <Link href="/suppliers/new">
            <Plus className="size-4" />
            New Supplier
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StatusTabs basePath="/suppliers" status={status} />
        <SearchInput
          initialQuery={query}
          placeholder="Search by code or name…"
          ariaLabel="Search suppliers"
        />
      </div>

      {suppliers.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background/60 px-6 py-12 text-center text-sm text-muted-foreground">
          {allSuppliers.length === 0 && !query
            ? "No suppliers yet. Add your first supplier to record bills."
            : "No suppliers match this filter."}
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
                <TableHead className="text-right">Bills</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id} className="relative odd:bg-muted/25">
                  <TableCell className="pl-3 font-mono text-xs font-medium">
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className="after:absolute after:inset-0 after:content-[''] hover:underline"
                    >
                      {supplier.code}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {supplier.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {supplier.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {supplier.billCount}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCents(supplier.outstandingCents)}
                  </TableCell>
                  <TableCell>
                    <ActiveBadge active={supplier.isActive} />
                  </TableCell>
                  <TableCell className="pr-3">
                    <div className="relative z-10 flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/suppliers/${supplier.id}/edit`}>Edit</Link>
                      </Button>
                      <SupplierStatusButton
                        supplierId={supplier.id}
                        supplierCode={supplier.code}
                        isActive={supplier.isActive}
                        billCount={supplier.billCount}
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
