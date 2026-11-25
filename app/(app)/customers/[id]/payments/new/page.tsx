import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerPaymentForm } from "@/components/forms/customer-payment-form";
import { listOpenInvoicesForCustomer } from "@/lib/accounting/ar-queries";
import { getCustomer } from "@/lib/accounting/queries";
import { todayDateInput } from "@/lib/dates";

export const metadata = { title: "Record payment" };

export default async function NewCustomerPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);

  if (!customer) notFound();

  const invoices = await listOpenInvoicesForCustomer(customer.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Record payment
          </h1>
          <p className="text-sm text-muted-foreground">
            Receipt from {customer.code} — {customer.name}. Allocate the full
            amount to open invoices.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/customers/${customer.id}/payments`}>
            <ArrowLeft className="size-4" />
            Back to payments
          </Link>
        </Button>
      </div>

      <CustomerPaymentForm
        customer={{
          id: customer.id,
          code: customer.code,
          name: customer.name,
        }}
        invoices={invoices}
        today={todayDateInput()}
      />
    </div>
  );
}
