import { PrintHeader } from "@/components/reports/print-header";
import { ReportPeriodPicker } from "@/components/reports/report-period-picker";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getCustomerBalances,
  resolveAgingAsOfDate,
} from "@/lib/accounting/reports";
import { formatDateDisplay, formatDateInput } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Customer Balances" };

export default async function CustomerBalancesPage({
  searchParams,
}: {
  searchParams: Promise<{ asOfDate?: string }>;
}) {
  const params = await searchParams;
  const asOfDate = resolveAgingAsOfDate(params);
  const report = await getCustomerBalances(asOfDate);
  const asOfLabel = formatDateDisplay(asOfDate);

  return (
    <div className="space-y-5">
      <PrintHeader title="Customer Balances" period={`As of ${asOfLabel}`} />

      <div className="print:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Customer Balances
        </h1>
        <p className="text-sm text-muted-foreground">
          Invoiced, paid and outstanding per customer as of {asOfLabel}, highest
          outstanding first.
        </p>
      </div>

      <ReportPeriodPicker
        mode="asOf"
        defaultFromDate={formatDateInput(asOfDate)}
        defaultToDate={formatDateInput(asOfDate)}
      />

      <Card>
        <CardContent>
          <Table className="print:text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Invoiced</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-muted-foreground"
                  >
                    No invoices as of this date.
                  </TableCell>
                </TableRow>
              ) : (
                report.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.code}
                      </span>
                      <span className="ml-2 font-medium">{row.name}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCents(row.invoicedCents)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCents(row.paidCents)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium tabular-nums">
                      {formatCents(row.outstandingCents)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Totals</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatCents(report.totalInvoicedCents)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatCents(report.totalPaidCents)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {formatCents(report.totalOutstandingCents)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
