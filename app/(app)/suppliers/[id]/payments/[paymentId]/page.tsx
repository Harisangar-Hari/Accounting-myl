import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupplierPayment } from "@/lib/accounting/ap-queries";
import { formatDateDisplay } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Supplier payment" };

export default async function SupplierPaymentPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  const { id, paymentId } = await params;
  const payment = await getSupplierPayment(paymentId);

  if (!payment || payment.supplier.id !== id) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/suppliers/${payment.supplier.id}/payments`}>
            <ArrowLeft className="size-4" />
            Back to payments
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/suppliers/${payment.supplier.id}`}>View supplier</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-base">
            {payment.paymentNo}
          </CardTitle>
          <CardDescription>
            {payment.supplier.code} — {payment.supplier.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Payment date</p>
              <p className="font-medium">
                {formatDateDisplay(payment.paymentDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="font-mono font-medium tabular-nums">
                {formatCents(payment.amountCents)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Method</p>
              <p className="font-medium">{payment.method}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reference</p>
              <p className="font-medium">{payment.reference ?? "—"}</p>
            </div>
          </div>

          {payment.notes ? (
            <div>
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="font-medium">{payment.notes}</p>
            </div>
          ) : null}

          <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Posted payments are immutable — no edit or delete route exists.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allocations</CardTitle>
          <CardDescription>The payment was applied to these bills.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-3">Bill</TableHead>
                  <TableHead>Bill date</TableHead>
                  <TableHead className="text-right">Bill total</TableHead>
                  <TableHead className="pr-3 text-right">Amount applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.allocations.map((allocation) => (
                  <TableRow key={allocation.id} className="odd:bg-muted/25">
                    <TableCell className="pl-3 font-mono text-xs font-medium">
                      <Link
                        href={`/suppliers/${payment.supplier.id}/bills/${allocation.bill.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {allocation.bill.billNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateDisplay(allocation.bill.billDate)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCents(allocation.bill.totalCents)}
                    </TableCell>
                    <TableCell className="pr-3 text-right font-mono tabular-nums">
                      {formatCents(allocation.amountCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Journal entry</CardTitle>
          <CardDescription>
            Generated automatically: Debit Accounts Payable, credit cash/bank.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <Link
            href={`/journal/${payment.journalEntry.id}`}
            className="font-mono font-medium underline-offset-4 hover:underline"
          >
            {payment.journalEntry.entryNo}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
