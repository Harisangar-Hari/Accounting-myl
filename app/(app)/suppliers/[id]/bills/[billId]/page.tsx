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
import { getSupplierBill } from "@/lib/accounting/ap-queries";
import { formatDateDisplay } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Bill" };

export default async function SupplierBillPage({
  params,
}: {
  params: Promise<{ id: string; billId: string }>;
}) {
  const { id, billId } = await params;
  const bill = await getSupplierBill(billId);

  if (!bill || bill.supplier.id !== id) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/suppliers/${bill.supplier.id}/bills`}>
            <ArrowLeft className="size-4" />
            Back to bills
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/suppliers/${bill.supplier.id}`}>View supplier</Link>
          </Button>
          {bill.outstandingCents > 0 ? (
            <Button asChild size="sm">
              <Link href={`/suppliers/${bill.supplier.id}/payments/new`}>
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
            <CardTitle className="font-mono text-base">{bill.billNo}</CardTitle>
            <DocumentStatusBadge
              status={bill.status}
              isOverdue={bill.isOverdue}
            />
          </div>
          <CardDescription>
            {bill.supplier.code} — {bill.supplier.name}
            {bill.supplierRef ? ` · Supplier ref ${bill.supplierRef}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Bill date</p>
              <p className="font-medium">{formatDateDisplay(bill.billDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due date</p>
              <p className="font-medium">{formatDateDisplay(bill.dueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-mono font-medium tabular-nums">
                {formatCents(bill.totalCents)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="font-mono font-medium tabular-nums">
                {formatCents(bill.outstandingCents)}
              </p>
            </div>
          </div>

          {bill.description ? (
            <div>
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="font-medium">{bill.description}</p>
            </div>
          ) : null}

          <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Posted documents are immutable — bills cannot be edited or
              deleted.
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
                <TableHead>Expense account</TableHead>
                <TableHead>Job / Site</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="pr-3 text-right">Tax</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bill.lines.map((line) => (
                <TableRow key={line.id} className="odd:bg-muted/25">
                  <TableCell className="pl-3 text-xs text-muted-foreground">
                    {line.lineNo}
                  </TableCell>
                  <TableCell className="font-medium">{line.description}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {line.expenseAccount.code}
                    </span>
                    <span className="ml-2">{line.expenseAccount.name}</span>
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
                  {formatCents(bill.subtotalCents)}
                </TableCell>
                <TableCell className="pr-3 text-right font-mono tabular-nums">
                  {formatCents(bill.taxCents)}
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
                  {formatCents(bill.totalCents)}
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
              Generated automatically: Debit expenses and Input VAT, credit
              Accounts Payable.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href={`/journal/${bill.journalEntry.id}`}
              className="font-mono font-medium underline-offset-4 hover:underline"
            >
              {bill.journalEntry.entryNo}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments applied</CardTitle>
            <CardDescription>
              Total paid {formatCents(bill.paidCents)} of{" "}
              {formatCents(bill.totalCents)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bill.allocations.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No payments applied to this bill yet.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {bill.allocations.map((allocation) => (
                  <li
                    key={allocation.id}
                    className="flex items-center justify-between gap-3 border-b pb-1.5 last:border-b-0"
                  >
                    <span>
                      <Link
                        href={`/suppliers/${bill.supplier.id}/payments/${allocation.payment.id}`}
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
