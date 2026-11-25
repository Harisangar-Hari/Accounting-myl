import Link from "next/link";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BillListItem } from "@/lib/accounting/ap-queries";
import { formatDateDisplay } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export function BillTable({
  bills,
  showSupplier = true,
  emptyMessage = "No bills yet.",
}: {
  bills: BillListItem[];
  showSupplier?: boolean;
  emptyMessage?: string;
}) {
  if (bills.length === 0) {
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
            <TableHead className="pl-3">Bill</TableHead>
            {showSupplier ? <TableHead>Supplier</TableHead> : null}
            <TableHead>Date</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead className="pr-3">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((bill) => (
            <TableRow key={bill.id} className="relative odd:bg-muted/25">
              <TableCell className="pl-3 font-mono text-xs font-medium">
                <Link
                  href={`/suppliers/${bill.supplierId}/bills/${bill.id}`}
                  className="after:absolute after:inset-0 after:content-[''] hover:underline"
                >
                  {bill.billNo}
                </Link>
              </TableCell>
              {showSupplier ? (
                <TableCell>
                  <Link
                    href={`/suppliers/${bill.supplierId}`}
                    className="relative z-10 hover:underline"
                  >
                    {bill.supplierName}
                  </Link>
                </TableCell>
              ) : null}
              <TableCell className="text-muted-foreground">
                {formatDateDisplay(bill.billDate)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateDisplay(bill.dueDate)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatCents(bill.totalCents)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatCents(bill.outstandingCents)}
              </TableCell>
              <TableCell className="pr-3">
                <DocumentStatusBadge
                  status={bill.status}
                  isOverdue={bill.isOverdue}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
