import { PrintHeader } from "@/components/reports/print-header";
import { ReportPeriodPicker } from "@/components/reports/report-period-picker";
import {
  OutOfBalanceBanner,
  ReconcilesBadge,
} from "@/components/reports/report-status";
import { Badge } from "@/components/ui/badge";
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
import { getTrialBalance, resolveReportPeriod } from "@/lib/accounting/reports";
import { formatDateDisplay, formatDateInput } from "@/lib/dates";
import { formatCents, formatSignedCents } from "@/lib/money";

export const metadata = { title: "Trial Balance" };

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ fromDate?: string; toDate?: string }>;
}) {
  const params = await searchParams;
  const period = resolveReportPeriod(params);
  const report = await getTrialBalance(period);
  const balanced = report.totalDebitCents === report.totalCreditCents;
  const periodLabel = `${formatDateDisplay(period.fromDate)} to ${formatDateDisplay(period.toDate)}`;

  return (
    <div className="space-y-5">
      <PrintHeader title="Trial Balance" period={`Period: ${periodLabel}`} />

      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Trial Balance
          </h1>
          <p className="text-sm text-muted-foreground">
            Posted activity for {periodLabel}. Draft entries are excluded.
          </p>
        </div>
        <ReconcilesBadge ok={balanced} label="Balanced" />
      </div>

      <ReportPeriodPicker
        mode="range"
        defaultFromDate={formatDateInput(period.fromDate)}
        defaultToDate={formatDateInput(period.toDate)}
      />

      {!balanced ? (
        <OutOfBalanceBanner message="OUT OF BALANCE — posted debits do not equal posted credits." />
      ) : null}

      <div className="space-y-2 print:block print:w-full">
        <Card>
          <CardContent>
            <Table className="print:text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Net Debit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-6 text-center text-muted-foreground"
                    >
                      No posted activity in this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.rows.map((row) => (
                    <TableRow key={row.accountId}>
                      <TableCell className="font-mono text-xs">
                        {row.accountCode}
                      </TableCell>
                      <TableCell>{row.accountName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {row.accountType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.debitCents === 0 ? "" : formatCents(row.debitCents)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {row.creditCents === 0 ? "" : formatCents(row.creditCents)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatSignedCents(row.netDebitCents)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Totals</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCents(report.totalDebitCents)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCents(report.totalCreditCents)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatSignedCents(
                      report.totalDebitCents - report.totalCreditCents,
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              Amounts are in the ledger currency. Figures in parentheses are
              credit (negative) balances. Accounts with no posted activity in the
              period are omitted.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
