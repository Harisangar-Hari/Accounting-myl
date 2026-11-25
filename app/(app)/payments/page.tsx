import { PaymentTable } from "@/components/documents/payment-table";
import { SearchInput } from "@/components/documents/search-input";
import { listCustomerPayments } from "@/lib/accounting/ar-queries";
import { parseOptionalDateParam } from "@/lib/dates";
import { formatCents, sumCents } from "@/lib/money";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; fromDate?: string; toDate?: string }>;
}) {
  const params = await searchParams;
  const payments = await listCustomerPayments({
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
            Customer payments
          </h1>
          <p className="text-sm text-muted-foreground">
            {payments.length} receipt{payments.length === 1 ? "" : "s"} totalling{" "}
            {formatCents(totalCents)}. Each receipt posts Debit cash/bank, Credit
            1100 Accounts Receivable.
          </p>
        </div>
        <SearchInput
          initialQuery={params.q ?? ""}
          placeholder="Search receipt no. or customer…"
          ariaLabel="Search payments"
        />
      </div>

      <PaymentTable
        payments={payments}
        emptyMessage="No customer payments recorded yet."
      />
    </div>
  );
}
