import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceForm } from "@/components/forms/invoice-form";
import { getDocumentFormOptions } from "@/lib/accounting/document-options";
import { getCustomer } from "@/lib/accounting/queries";
import { addDaysInput, todayDateInput } from "@/lib/dates";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, options] = await Promise.all([
    getCustomer(id),
    getDocumentFormOptions(),
  ]);

  if (!customer) notFound();

  const today = todayDateInput();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            New invoice
          </h1>
          <p className="text-sm text-muted-foreground">
            Invoicing {customer.code} — {customer.name}. The invoice posts a
            balanced journal entry immediately.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/customers/${customer.id}/invoices`}>
            <ArrowLeft className="size-4" />
            Back to invoices
          </Link>
        </Button>
      </div>

      <InvoiceForm
        customer={{
          id: customer.id,
          code: customer.code,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          isActive: customer.isActive,
        }}
        revenueAccounts={options.revenueAccounts}
        jobs={options.jobs}
        today={today}
        defaultDueDate={addDaysInput(today, 30)}
      />
    </div>
  );
}
