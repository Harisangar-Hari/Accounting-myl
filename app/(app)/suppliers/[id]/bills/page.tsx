import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { BillTable } from "@/components/documents/bill-table";
import { DocumentStatusTabs } from "@/components/documents/document-status-tabs";
import { Button } from "@/components/ui/button";
import { listSupplierBills, getSupplier } from "@/lib/accounting/ap-queries";
import { parseDocumentStatusFilter } from "@/lib/accounting/documents";
import { parseOptionalDateParam } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Supplier bills" };

export default async function SupplierBillsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    status?: string;
    fromDate?: string;
    toDate?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supplier = await getSupplier(id);

  if (!supplier) notFound();

  const status = parseDocumentStatusFilter(query.status);
  const bills = await listSupplierBills({
    supplierId: supplier.id,
    status,
    fromDate: parseOptionalDateParam(query.fromDate),
    toDate: parseOptionalDateParam(query.toDate),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Bills
          </h1>
          <p className="text-sm text-muted-foreground">
            {supplier.code} — {supplier.name}.{" "}
            {supplier.outstandingCents > 0
              ? `Outstanding ${formatCents(supplier.outstandingCents)}.`
              : "Nothing outstanding."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/suppliers/${supplier.id}`}>
              <ArrowLeft className="size-4" />
              Back to supplier
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/suppliers/${supplier.id}/bills/new`}>
              <Plus className="size-4" />
              New Bill
            </Link>
          </Button>
        </div>
      </div>

      <DocumentStatusTabs
        basePath={`/suppliers/${supplier.id}/bills`}
        status={status}
        params={query}
      />

      <BillTable
        bills={bills}
        showSupplier={false}
        emptyMessage="No bills for this supplier yet."
      />
    </div>
  );
}
