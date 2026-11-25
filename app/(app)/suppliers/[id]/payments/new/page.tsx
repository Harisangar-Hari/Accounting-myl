import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupplierPaymentForm } from "@/components/forms/supplier-payment-form";
import { getSupplier, listOpenBillsForSupplier } from "@/lib/accounting/ap-queries";
import { todayDateInput } from "@/lib/dates";

export const metadata = { title: "Record supplier payment" };

export default async function NewSupplierPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplier(id);

  if (!supplier) notFound();

  const bills = await listOpenBillsForSupplier(supplier.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Record payment
          </h1>
          <p className="text-sm text-muted-foreground">
            Payment to {supplier.code} — {supplier.name}. Allocate the full
            amount to open bills.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/suppliers/${supplier.id}/payments`}>
            <ArrowLeft className="size-4" />
            Back to payments
          </Link>
        </Button>
      </div>

      <SupplierPaymentForm
        supplier={{
          id: supplier.id,
          code: supplier.code,
          name: supplier.name,
        }}
        bills={bills}
        today={todayDateInput()}
      />
    </div>
  );
}
