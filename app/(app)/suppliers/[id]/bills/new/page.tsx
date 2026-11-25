import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BillForm } from "@/components/forms/bill-form";
import { getSupplier } from "@/lib/accounting/ap-queries";
import { getDocumentFormOptions } from "@/lib/accounting/document-options";
import { addDaysInput, todayDateInput } from "@/lib/dates";

export const metadata = { title: "New bill" };

export default async function NewBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [supplier, options] = await Promise.all([
    getSupplier(id),
    getDocumentFormOptions(),
  ]);

  if (!supplier) notFound();

  const today = todayDateInput();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            New bill
          </h1>
          <p className="text-sm text-muted-foreground">
            Recording a bill from {supplier.code} — {supplier.name}. The bill
            posts a balanced journal entry immediately.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/suppliers/${supplier.id}/bills`}>
            <ArrowLeft className="size-4" />
            Back to bills
          </Link>
        </Button>
      </div>

      <BillForm
        supplier={{
          id: supplier.id,
          code: supplier.code,
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          isActive: supplier.isActive,
        }}
        expenseAccounts={options.expenseAccounts}
        jobs={options.jobs}
        today={today}
        defaultDueDate={addDaysInput(today, 30)}
      />
    </div>
  );
}
