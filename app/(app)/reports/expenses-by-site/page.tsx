import { PrintHeader } from "@/components/reports/print-header";
import { ReportPeriodPicker } from "@/components/reports/report-period-picker";
import { ReconcilesBadge } from "@/components/reports/report-status";
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
  getExpensesByJobSite,
  getProfitAndLoss,
  resolveReportPeriod,
} from "@/lib/accounting/reports";
import { formatDateDisplay, formatDateInput } from "@/lib/dates";
import { formatSignedCents } from "@/lib/money";

export const metadata = { title: "Expenses by Site" };

export default async function ExpensesBySitePage({
  searchParams,
}: {
  searchParams: Promise<{ fromDate?: string; toDate?: string }>;
}) {
  const params = await searchParams;
  const period = resolveReportPeriod(params);
  const [report, pnl] = await Promise.all([
    getExpensesByJobSite(period, "site"),
    getProfitAndLoss(period),
  ]);
  const reconciles = report.grandTotalCents === pnl.totalExpenseCents;
  const periodLabel = `${formatDateDisplay(period.fromDate)} to ${formatDateDisplay(period.toDate)}`;
  const empty = report.grandTotalCents === 0;

  return (
    <div className="space-y-5">
      <PrintHeader title="Expenses by Site" period={`Period: ${periodLabel}`} />

      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Expenses by Site
          </h1>
          <p className="text-sm text-muted-foreground">
            Expense-account spend per site for {periodLabel}. Draft entries are
            excluded.
          </p>
        </div>
        <ReconcilesBadge ok={reconciles} label="Reconciles with P&L" />
      </div>

      <ReportPeriodPicker
        mode="range"
        defaultFromDate={formatDateInput(period.fromDate)}
        defaultToDate={formatDateInput(period.toDate)}
      />

      <div className="space-y-2 print:block print:w-full">
        <Card>
          <CardContent>
            <Table className="print:text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Job Code</TableHead>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Site Code</TableHead>
                  <TableHead>Site Name</TableHead>
                  <TableHead className="text-right">Total Expenses</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empty ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-6 text-center text-muted-foreground"
                    >
                      No expense activity in this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.rows.map((row) => (
                    <TableRow
                      key={row.untagged ? "unallocated" : row.siteId}
                      className={row.untagged ? "bg-muted/40 text-muted-foreground" : undefined}
                    >
                      <TableCell className="font-mono text-xs">
                        {row.untagged ? "—" : (row.parentJobCode ?? "—")}
                      </TableCell>
                      <TableCell className={row.untagged ? undefined : "text-muted-foreground"}>
                        {row.untagged ? "—" : (row.parentJobName ?? "—")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.untagged ? "—" : row.siteCode}
                      </TableCell>
                      <TableCell className={row.untagged ? "italic" : undefined}>
                        {row.untagged ? "Unallocated (no site)" : row.siteName}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatSignedCents(row.totalDebitCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.lineCount}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Grand total</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatSignedCents(report.grandTotalCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {report.rows.reduce((sum, row) => sum + row.lineCount, 0)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              Only expense accounts are counted. The grand total equals total
              expenses on the Profit &amp; Loss for the same period
              ({formatSignedCents(pnl.totalExpenseCents)}).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
