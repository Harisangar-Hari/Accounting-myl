import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { SupplierPaymentTable } from "@/components/documents/supplier-payment-table";
import { Button } from "@/components/ui/button";
import { getSupplier, listSupplierPayments } from "@/lib/accounting/ap-queries";

export const metadata = { title: "Supplier payments" };

export default async function SupplierPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplier(id);

  if (!supplier) notFound();

  const payments = await listSupplierPayments({ supplierId: supplier.id });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Payments
          </h1>
          <p className="text-sm text-muted-foreground">
            {supplier.code} — {supplier.name}. Payments recorded against bills.
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
            <Link href={`/suppliers/${supplier.id}/payments/new`}>
              <Plus className="size-4" />
              Record Payment
            </Link>
          </Button>
        </div>
      </div>

      <SupplierPaymentTable
        payments={payments}
        showSupplier={false}
        emptyMessage="No payments recorded for this supplier yet."
      />
    </div>
  );
}
