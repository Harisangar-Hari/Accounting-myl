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
  getSupplierBalances,
  resolveAgingAsOfDate,
} from "@/lib/accounting/reports";
import { formatDateDisplay, formatDateInput } from "@/lib/dates";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Supplier Balances" };

export default async function SupplierBalancesPage({
  searchParams,
}: {
  searchParams: Promise<{ asOfDate?: string }>;
}) {
  const params = await searchParams;
  const asOfDate = resolveAgingAsOfDate(params);
  const report = await getSupplierBalances(asOfDate);
  const asOfLabel = formatDateDisplay(asOfDate);

  return (
    <div className="space-y-5">
      <PrintHeader title="Supplier Balances" period={`As of ${asOfLabel}`} />

      <div className="print:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Supplier Balances
        </h1>
        <p className="text-sm text-muted-foreground">
          Billed, paid and outstanding per supplier as of {asOfLabel}, highest
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
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Billed</TableHead>
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
                    No bills as of this date.
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
