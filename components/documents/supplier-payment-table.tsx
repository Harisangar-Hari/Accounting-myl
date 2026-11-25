import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SupplierPaymentListItem } from "@/lib/accounting/ap-queries";
import { formatDateDisplay } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export function SupplierPaymentTable({
  payments,
  showSupplier = true,
  emptyMessage = "No supplier payments yet.",
}: {
  payments: SupplierPaymentListItem[];
  showSupplier?: boolean;
  emptyMessage?: string;
}) {
  if (payments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background/60 px-6 py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="pl-3">Payment</TableHead>
            {showSupplier ? <TableHead>Supplier</TableHead> : null}
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">Bills</TableHead>
            <TableHead className="pr-3 text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id} className="relative odd:bg-muted/25">
              <TableCell className="pl-3 font-mono text-xs font-medium">
                <Link
                  href={`/suppliers/${payment.supplierId}/payments/${payment.id}`}
                  className="after:absolute after:inset-0 after:content-[''] hover:underline"
                >
                  {payment.paymentNo}
                </Link>
              </TableCell>
              {showSupplier ? (
                <TableCell>
                  <Link
                    href={`/suppliers/${payment.supplierId}`}
                    className="relative z-10 hover:underline"
                  >
                    {payment.supplierName}
                  </Link>
                </TableCell>
              ) : null}
              <TableCell className="text-muted-foreground">
                {formatDateDisplay(payment.paymentDate)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {payment.method}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {payment.reference ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {payment.allocationCount}
              </TableCell>
              <TableCell className="pr-3 text-right font-mono tabular-nums">
                {formatCents(payment.amountCents)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
