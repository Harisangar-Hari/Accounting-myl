import Link from "next/link";
import { Plus } from "lucide-react";
import { DocumentStatusTabs } from "@/components/documents/document-status-tabs";
import { InvoiceTable } from "@/components/documents/invoice-table";
import { SearchInput } from "@/components/documents/search-input";
import { SavedToast } from "@/components/saved-toast";
import { Button } from "@/components/ui/button";
import { listCustomerInvoices } from "@/lib/accounting/ar-queries";
import { parseDocumentStatusFilter } from "@/lib/accounting/documents";
import { parseOptionalDateParam } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { sumCents } from "@/lib/money";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({
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
  const invoices = await listCustomerInvoices({
    status,
    search: params.q,
    fromDate: parseOptionalDateParam(params.fromDate),
    toDate: parseOptionalDateParam(params.toDate),
  });

  const totalOutstanding = sumCents(
    invoices.map((invoice) => invoice.outstandingCents),
  );

  return (
    <div className="space-y-5">
      <SavedToast
        message={params.created ? `Invoice ${params.created} created.` : undefined}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Invoices
          </h1>
          <p className="text-sm text-muted-foreground">
            {invoices.length} invoice{invoices.length === 1 ? "" : "s"} ·
            outstanding {formatCents(totalOutstanding)}. Each invoice posts a
            balanced journal entry.
          </p>
        </div>
        <Button asChild>
          <Link href="/customers">
            <Plus className="size-4" />
            New Invoice
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DocumentStatusTabs
          basePath="/invoices"
          status={status}
          params={params}
        />
        <SearchInput
          initialQuery={params.q ?? ""}
          placeholder="Search invoice no. or customer…"
          ariaLabel="Search invoices"
        />
      </div>

      <InvoiceTable
        invoices={invoices}
        emptyMessage={
          params.q || status !== "all"
            ? "No invoices match this filter."
            : "No invoices yet. Pick a customer to raise the first invoice."
        }
      />
    </div>
  );
}
