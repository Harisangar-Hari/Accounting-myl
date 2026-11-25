import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, ReceiptText } from "lucide-react";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCustomerInvoice } from "@/lib/accounting/ar-queries";
import { formatDateDisplay } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Invoice" };

export default async function CustomerInvoicePage({
  params,
}: {
  params: Promise<{ id: string; invoiceId: string }>;
}) {
  const { id, invoiceId } = await params;
  const invoice = await getCustomerInvoice(invoiceId);

  if (!invoice || invoice.customer.id !== id) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/customers/${invoice.customer.id}/invoices`}>
            <ArrowLeft className="size-4" />
            Back to invoices
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/customers/${invoice.customer.id}`}>
              View customer
            </Link>
          </Button>
          {invoice.outstandingCents > 0 ? (
            <Button asChild size="sm">
              <Link href={`/customers/${invoice.customer.id}/payments/new`}>
                <ReceiptText className="size-4" />
                Record Payment
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-mono text-base">
              {invoice.invoiceNo}
            </CardTitle>
            <DocumentStatusBadge
              status={invoice.status}
              isOverdue={invoice.isOverdue}
            />
          </div>
          <CardDescription>
            {invoice.customer.code} — {invoice.customer.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Invoice date</p>
              <p className="font-medium">
                {formatDateDisplay(invoice.invoiceDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due date</p>
              <p className="font-medium">{formatDateDisplay(invoice.dueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-mono font-medium tabular-nums">
                {formatCents(invoice.totalCents)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="font-mono font-medium tabular-nums">
                {formatCents(invoice.outstandingCents)}
              </p>
            </div>
          </div>

          {invoice.description ? (
            <div>
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="font-medium">{invoice.description}</p>
            </div>
          ) : null}

          <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Posted documents are immutable — invoices cannot be edited or
              deleted. Corrections will be made with credit notes in a later
              phase.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-12 pl-3">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Revenue account</TableHead>
                <TableHead>Job / Site</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="pr-3 text-right">Tax</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.map((line) => (
                <TableRow key={line.id} className="odd:bg-muted/25">
                  <TableCell className="pl-3 text-xs text-muted-foreground">
                    {line.lineNo}
                  </TableCell>
                  <TableCell className="font-medium">{line.description}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {line.revenueAccount.code}
                    </span>
                    <span className="ml-2">{line.revenueAccount.name}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {line.job ? (
                      <span>
                        {line.job.code}
                        {line.site ? ` · ${line.site.code}` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCents(line.amountCents)}
                  </TableCell>
                  <TableCell className="pr-3 text-right font-mono tabular-nums">
                    {formatCents(line.taxCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="pl-3">
                  Subtotal
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatCents(invoice.subtotalCents)}
                </TableCell>
                <TableCell className="pr-3 text-right font-mono tabular-nums">
                  {formatCents(invoice.taxCents)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4} className="pl-3 font-semibold">
                  Total
                </TableCell>
                <TableCell
                  colSpan={2}
                  className="pr-3 text-right font-mono font-semibold tabular-nums"
                >
                  {formatCents(invoice.totalCents)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Journal entry</CardTitle>
            <CardDescription>
              Generated automatically when the invoice was posted.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-xs text-muted-foreground">Entry</p>
            <Link
              href={`/journal/${invoice.journalEntry.id}`}
              className="font-mono font-medium underline-offset-4 hover:underline"
            >
              {invoice.journalEntry.entryNo}
            </Link>
            <p className="mt-2 text-xs text-muted-foreground">
              Debit 1100 Accounts Receivable, credit revenue and Output VAT.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments applied</CardTitle>
            <CardDescription>
              Total paid {formatCents(invoice.paidCents)} of{" "}
              {formatCents(invoice.totalCents)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invoice.allocations.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No payments applied to this invoice yet.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {invoice.allocations.map((allocation) => (
                  <li
                    key={allocation.id}
                    className="flex items-center justify-between gap-3 border-b pb-1.5 last:border-b-0"
                  >
                    <span>
                      <Link
                        href={`/customers/${invoice.customer.id}/payments/${allocation.payment.id}`}
                        className="font-mono text-xs font-medium underline-offset-4 hover:underline"
                      >
                        {allocation.payment.paymentNo}
                      </Link>
                      <span className="ml-2 text-muted-foreground">
                        {formatDateDisplay(allocation.payment.paymentDate)} ·{" "}
                        {allocation.payment.method}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatCents(allocation.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
