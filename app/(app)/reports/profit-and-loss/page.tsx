import { PrintHeader } from "@/components/reports/print-header";
import { ReportPeriodPicker } from "@/components/reports/report-period-picker";
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
import {
  getProfitAndLoss,
  resolveReportPeriod,
} from "@/lib/accounting/reports";
import { formatDateDisplay, formatDateInput } from "@/lib/dates";
import { formatSignedCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata = { title: "Profit & Loss" };

export default async function ProfitAndLossPage({
  searchParams,
}: {
  searchParams: Promise<{ fromDate?: string; toDate?: string }>;
}) {
  const params = await searchParams;
  const period = resolveReportPeriod(params);
  const report = await getProfitAndLoss(period);
  const periodLabel = `${formatDateDisplay(period.fromDate)} to ${formatDateDisplay(period.toDate)}`;
  const empty =
    report.totalRevenueCents === 0 && report.totalExpenseCents === 0;

  return (
    <div className="space-y-5">
      <PrintHeader title="Profit & Loss" period={`Period: ${periodLabel}`} />

      <div className="print:hidden">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Profit &amp; Loss
        </h1>
        <p className="text-sm text-muted-foreground">
          Revenue and expense accounts for {periodLabel}. Draft entries are
          excluded.
        </p>
      </div>

      <ReportPeriodPicker
        mode="range"
        defaultFromDate={formatDateInput(period.fromDate)}
        defaultToDate={formatDateInput(period.toDate)}
      />

      <div className="space-y-4 print:block print:w-full">
        {empty ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              No posted activity in this period.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Revenue</CardTitle>
                <CardDescription>
                  Credits earned, less any revenue debits.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table className="print:text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.revenueLines.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-muted-foreground"
                        >
                          No revenue in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.revenueLines.map((line) => (
                        <TableRow key={line.accountId}>
                          <TableCell className="font-mono text-xs">
                            {line.accountCode}
                          </TableCell>
                          <TableCell>{line.accountName}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatSignedCents(line.netCents)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>Total revenue</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatSignedCents(report.totalRevenueCents)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expenses</CardTitle>
                <CardDescription>
                  Debits incurred, less any expense credits.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table className="print:text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.expenseLines.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-muted-foreground"
                        >
                          No expenses in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.expenseLines.map((line) => (
                        <TableRow key={line.accountId}>
                          <TableCell className="font-mono text-xs">
                            {line.accountCode}
                          </TableCell>
                          <TableCell>{line.accountName}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatSignedCents(line.netCents)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>Total expenses</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatSignedCents(report.totalExpenseCents)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>

            <div
              className={cn(
                "rounded-lg border px-4 py-3",
                report.netProfitCents >= 0
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-destructive/40 bg-destructive/10",
              )}
            >
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Net profit (loss)
              </p>
              <p
                className={cn(
                  "font-heading text-2xl font-semibold tabular-nums",
                  report.netProfitCents >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-destructive",
                )}
              >
                {formatSignedCents(report.netProfitCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                Revenue is shown as earned (credit balance); expenses as incurred
                (debit balance). Net profit = total revenue − total expenses.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
