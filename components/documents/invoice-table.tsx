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
import type { InvoiceListItem } from "@/lib/accounting/ar-queries";
import { formatDateDisplay } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export function InvoiceTable({
  invoices,
  showCustomer = true,
  emptyMessage = "No invoices yet.",
}: {
  invoices: InvoiceListItem[];
  showCustomer?: boolean;
  emptyMessage?: string;
}) {
  if (invoices.length === 0) {
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
            <TableHead className="pl-3">Invoice</TableHead>
            {showCustomer ? <TableHead>Customer</TableHead> : null}
            <TableHead>Date</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead className="pr-3">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id} className="relative odd:bg-muted/25">
              <TableCell className="pl-3 font-mono text-xs font-medium">
                <Link
                  href={`/customers/${invoice.customerId}/invoices/${invoice.id}`}
                  className="after:absolute after:inset-0 after:content-[''] hover:underline"
                >
                  {invoice.invoiceNo}
                </Link>
              </TableCell>
              {showCustomer ? (
                <TableCell>
                  <Link
                    href={`/customers/${invoice.customerId}`}
                    className="relative z-10 hover:underline"
                  >
                    {invoice.customerName}
                  </Link>
                </TableCell>
              ) : null}
              <TableCell className="text-muted-foreground">
                {formatDateDisplay(invoice.invoiceDate)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateDisplay(invoice.dueDate)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatCents(invoice.totalCents)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatCents(invoice.outstandingCents)}
              </TableCell>
              <TableCell className="pr-3">
                <DocumentStatusBadge
                  status={invoice.status}
                  isOverdue={invoice.isOverdue}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
