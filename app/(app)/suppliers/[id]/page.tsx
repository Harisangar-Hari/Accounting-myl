import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, ReceiptText } from "lucide-react";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { ActiveBadge } from "@/components/status-badge";
import { SupplierStatusButton } from "@/components/suppliers/supplier-status-button";
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
import { getSupplier } from "@/lib/accounting/ap-queries";
import { isDocumentOverdue } from "@/lib/accounting/documents";
import { formatDateDisplay } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Supplier" };

function ContactField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="whitespace-pre-line font-medium">
        {value && value.length > 0 ? value : "—"}
      </p>
    </div>
  );
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplier(id);

  if (!supplier) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {supplier.code}
            </span>
            <ActiveBadge active={supplier.isActive} />
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {supplier.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/suppliers">
              <ArrowLeft className="size-4" />
              Back to suppliers
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/suppliers/${supplier.id}/edit`}>Edit</Link>
          </Button>
          <SupplierStatusButton
            supplierId={supplier.id}
            supplierCode={supplier.code}
            isActive={supplier.isActive}
            billCount={supplier._count.bills}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Outstanding</CardDescription>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {formatCents(supplier.outstandingCents)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Open bills across {supplier._count.bills} bill
              {supplier._count.bills === 1 ? "" : "s"}.
            </p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Purchasing</CardTitle>
              <CardDescription>
                Bills debit expense accounts; payments credit cash or bank.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/suppliers/${supplier.id}/bills/new`}>
                  <Plus className="size-4" />
                  New Bill
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/suppliers/${supplier.id}/payments/new`}>
                  <ReceiptText className="size-4" />
                  Record Payment
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <ContactField label="Email" value={supplier.email} />
          <ContactField label="Phone" value={supplier.phone} />
          <ContactField label="Address" value={supplier.address} />
          <ContactField label="Tax ID" value={supplier.taxId} />
          <div className="sm:col-span-2">
            <ContactField label="Notes" value={supplier.notes} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Bills</CardTitle>
            <CardDescription>Most recent 10 bills.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/suppliers/${supplier.id}/bills`}>View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {supplier.bills.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-background/60 px-6 py-10 text-center text-sm text-muted-foreground">
              No bills recorded for this supplier yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-3">Bill</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.bills.map((bill) => (
                    <TableRow key={bill.id} className="relative odd:bg-muted/25">
                      <TableCell className="pl-3 font-mono text-xs font-medium">
                        <Link
                          href={`/suppliers/${supplier.id}/bills/${bill.id}`}
                          className="after:absolute after:inset-0 after:content-[''] hover:underline"
                        >
                          {bill.billNo}
                        </Link>
                      </TableCell>
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
                        {formatCents(bill.totalCents - bill.paidCents)}
                      </TableCell>
                      <TableCell>
                        <DocumentStatusBadge
                          status={bill.status}
                          isOverdue={isDocumentOverdue(
                            bill.status,
                            bill.dueDate,
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Payments</CardTitle>
            <CardDescription>Most recent 10 payments.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/suppliers/${supplier.id}/payments`}>View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {supplier.payments.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-background/60 px-6 py-10 text-center text-sm text-muted-foreground">
              No payments recorded for this supplier yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-3">Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.payments.map((payment) => (
                    <TableRow
                      key={payment.id}
                      className="relative odd:bg-muted/25"
                    >
                      <TableCell className="pl-3 font-mono text-xs font-medium">
                        <Link
                          href={`/suppliers/${supplier.id}/payments/${payment.id}`}
                          className="after:absolute after:inset-0 after:content-[''] hover:underline"
                        >
                          {payment.paymentNo}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateDisplay(payment.paymentDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.method}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatCents(payment.amountCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-medium">{formatDateDisplay(supplier.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last updated</p>
            <p className="font-medium">{formatDateDisplay(supplier.updatedAt)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
