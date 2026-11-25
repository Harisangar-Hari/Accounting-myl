import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { PaymentTable } from "@/components/documents/payment-table";
import { Button } from "@/components/ui/button";
import { listCustomerPayments } from "@/lib/accounting/ar-queries";
import { getCustomer } from "@/lib/accounting/queries";

export const metadata = { title: "Customer payments" };

export default async function CustomerPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);

  if (!customer) notFound();

  const payments = await listCustomerPayments({ customerId: customer.id });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Payments
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer.code} — {customer.name}. Receipts recorded against
            invoices.
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
            <Link href={`/customers/${customer.id}/payments/new`}>
              <Plus className="size-4" />
              Record Payment
            </Link>
          </Button>
        </div>
      </div>

      <PaymentTable
        payments={payments}
        showCustomer={false}
        emptyMessage="No payments recorded for this customer yet."
      />
    </div>
  );
}
