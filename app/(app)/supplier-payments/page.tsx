import { SearchInput } from "@/components/documents/search-input";
import { SupplierPaymentTable } from "@/components/documents/supplier-payment-table";
import { listSupplierPayments } from "@/lib/accounting/ap-queries";
import { parseOptionalDateParam } from "@/lib/dates";
import { formatCents, sumCents } from "@/lib/money";

export const metadata = { title: "Supplier payments" };

export default async function SupplierPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; fromDate?: string; toDate?: string }>;
}) {
  const params = await searchParams;
  const payments = await listSupplierPayments({
    search: params.q,
    fromDate: parseOptionalDateParam(params.fromDate),
    toDate: parseOptionalDateParam(params.toDate),
  });

  const totalCents = sumCents(payments.map((payment) => payment.amountCents));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Supplier payments
          </h1>
          <p className="text-sm text-muted-foreground">
            {payments.length} payment{payments.length === 1 ? "" : "s"} totalling{" "}
            {formatCents(totalCents)}. Each payment posts Debit 2000 Accounts
            Payable, Credit cash/bank.
          </p>
        </div>
        <SearchInput
          initialQuery={params.q ?? ""}
          placeholder="Search payment no. or supplier…"
          ariaLabel="Search supplier payments"
        />
      </div>

      <SupplierPaymentTable
        payments={payments}
        emptyMessage="No supplier payments recorded yet."
      />
    </div>
  );
}
