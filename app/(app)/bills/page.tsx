import Link from "next/link";
import { Plus } from "lucide-react";
import { BillTable } from "@/components/documents/bill-table";
import { DocumentStatusTabs } from "@/components/documents/document-status-tabs";
import { SearchInput } from "@/components/documents/search-input";
import { SavedToast } from "@/components/saved-toast";
import { Button } from "@/components/ui/button";
import { listSupplierBills } from "@/lib/accounting/ap-queries";
import { parseDocumentStatusFilter } from "@/lib/accounting/documents";
import { parseOptionalDateParam } from "@/lib/dates";
import { formatCents, sumCents } from "@/lib/money";

export const metadata = { title: "Bills" };

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    fromDate?: string;
    toDate?: string;
    created?: string;
  }>;
}) {
  const params = await searchParams;
  const status = parseDocumentStatusFilter(params.status);
  const bills = await listSupplierBills({
    status,
    search: params.q,
    fromDate: parseOptionalDateParam(params.fromDate),
    toDate: parseOptionalDateParam(params.toDate),
  });

  const totalOutstanding = sumCents(bills.map((bill) => bill.outstandingCents));

  return (
    <div className="space-y-5">
      <SavedToast
        message={params.created ? `Bill ${params.created} created.` : undefined}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Bills
          </h1>
          <p className="text-sm text-muted-foreground">
            {bills.length} bill{bills.length === 1 ? "" : "s"} · outstanding{" "}
            {formatCents(totalOutstanding)}. Each bill posts a balanced journal
            entry.
          </p>
        </div>
        <Button asChild>
          <Link href="/suppliers">
            <Plus className="size-4" />
            New Bill
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DocumentStatusTabs basePath="/bills" status={status} params={params} />
        <SearchInput
          initialQuery={params.q ?? ""}
          placeholder="Search bill no., ref or supplier…"
          ariaLabel="Search bills"
        />
      </div>

      <BillTable
        bills={bills}
        emptyMessage={
          params.q || status !== "all"
            ? "No bills match this filter."
            : "No bills yet. Pick a supplier to record the first bill."
        }
      />
    </div>
  );
}
