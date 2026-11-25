import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { DocumentStatusTabs } from "@/components/documents/document-status-tabs";
import { InvoiceTable } from "@/components/documents/invoice-table";
import { Button } from "@/components/ui/button";
import { listCustomerInvoices } from "@/lib/accounting/ar-queries";
import { parseDocumentStatusFilter } from "@/lib/accounting/documents";
import { getCustomer } from "@/lib/accounting/queries";
import { parseOptionalDateParam } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Customer invoices" };

export default async function CustomerInvoicesPage({
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
  const customer = await getCustomer(id);

  if (!customer) notFound();

  const status = parseDocumentStatusFilter(query.status);
  const invoices = await listCustomerInvoices({
    customerId: customer.id,
    status,
    fromDate: parseOptionalDateParam(query.fromDate),
    toDate: parseOptionalDateParam(query.toDate),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Invoices
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer.code} — {customer.name}.{" "}
            {customer.outstandingCents > 0
              ? `Outstanding ${formatCents(customer.outstandingCents)}.`
              : "Nothing outstanding."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/customers/${customer.id}`}>
              <ArrowLeft className="size-4" />
              Back to customer
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/customers/${customer.id}/invoices/new`}>
              <Plus className="size-4" />
              New Invoice
            </Link>
          </Button>
        </div>
      </div>

      <DocumentStatusTabs
        basePath={`/customers/${customer.id}/invoices`}
        status={status}
        params={query}
      />

      <InvoiceTable
        invoices={invoices}
        showCustomer={false}
        emptyMessage={
          customer.isActive
            ? "No invoices for this customer yet."
            : "This customer is inactive. Reactivate it to invoice again."
        }
      />
    </div>
  );
}
