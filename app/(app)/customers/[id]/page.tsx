import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, ReceiptText } from "lucide-react";
import { CustomerStatusButton } from "@/components/customers/customer-status-button";
import { InvoiceTable } from "@/components/documents/invoice-table";
import { PaymentTable } from "@/components/documents/payment-table";
import { ActiveBadge } from "@/components/status-badge";
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
import {
  listCustomerInvoices,
  listCustomerPayments,
} from "@/lib/accounting/ar-queries";
import { getCustomer } from "@/lib/accounting/queries";
import { formatDateDisplay } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Customer" };

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

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);

  if (!customer) notFound();

  const [invoices, payments] = await Promise.all([
    listCustomerInvoices({ customerId: customer.id, limit: 10 }),
    listCustomerPayments({ customerId: customer.id, limit: 10 }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {customer.code}
            </span>
            <ActiveBadge active={customer.isActive} />
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {customer.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/customers">
              <ArrowLeft className="size-4" />
              Back to customers
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/customers/${customer.id}/edit`}>Edit</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/customers/${customer.id}/invoices/new`}>
              <Plus className="size-4" />
              New Invoice
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/customers/${customer.id}/payments/new`}>
              <ReceiptText className="size-4" />
              Record Payment
            </Link>
          </Button>
          <CustomerStatusButton
            customerId={customer.id}
            customerCode={customer.code}
            isActive={customer.isActive}
            jobCount={customer.jobs.length}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <CardTitle className="font-mono text-2xl tabular-nums">
              {formatCents(customer.outstandingCents)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Open invoice balances across {customer._count.invoices} invoice
              {customer._count.invoices === 1 ? "" : "s"} and{" "}
              {customer._count.payments} receipt
              {customer._count.payments === 1 ? "" : "s"}.
            </p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle>Accounts receivable</CardTitle>
            <CardDescription>
              Invoices debit 1100 Accounts Receivable and credit revenue;
              receipts credit AR and debit cash or bank. Documents are immutable.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <ContactField label="Email" value={customer.email} />
          <ContactField label="Phone" value={customer.phone} />
          <ContactField label="Address" value={customer.address} />
          <ContactField label="Tax ID" value={customer.taxId} />
          <div className="sm:col-span-2">
            <ContactField label="Notes" value={customer.notes} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Most recent 10 invoices.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/customers/${customer.id}/invoices`}>View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <InvoiceTable
            invoices={invoices}
            showCustomer={false}
            emptyMessage="No invoices for this customer yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Payments</CardTitle>
            <CardDescription>Most recent 10 receipts.</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/customers/${customer.id}/payments`}>View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <PaymentTable
            payments={payments}
            showCustomer={false}
            emptyMessage="No payments recorded for this customer yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Jobs</CardTitle>
            <CardDescription>
              {customer.jobs.length} job
              {customer.jobs.length === 1 ? "" : "s"} linked to this customer.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/jobs/new?customerId=${customer.id}`}>
              <Plus className="size-4" />
              Add Job
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {customer.jobs.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-background/60 px-6 py-10 text-center text-sm text-muted-foreground">
              No jobs linked to this customer yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="pl-3">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.jobs.map((job) => (
                    <TableRow key={job.id} className="odd:bg-muted/25">
                      <TableCell className="pl-3 font-mono text-xs font-medium">
                        {job.code}
                      </TableCell>
                      <TableCell className="font-medium">{job.name}</TableCell>
                      <TableCell>
                        <ActiveBadge active={job.isActive} />
                      </TableCell>
                      <TableCell className="pr-3">
                        <div className="flex items-center justify-end">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/jobs/${job.id}`}>View</Link>
                          </Button>
                        </div>
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
            <p className="font-medium">
              {formatDateDisplay(customer.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last updated</p>
            <p className="font-medium">
              {formatDateDisplay(customer.updatedAt)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
